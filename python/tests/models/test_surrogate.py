import pytest
import torch
import numpy as np
import onnxruntime as ort
from pathlib import Path

from models.surrogate import SurrogateMLP

@pytest.fixture
def model_config():
    return {
        "input_dim": 2,
        "output_dim": 202, # 101 freq points, real+imag interleaved
        "hidden_dim": 64,
        "n_hidden_layers": 2,
    }

@pytest.fixture
def surrogate_model(model_config):
    """Provides a SurrogateMLP instance."""
    return SurrogateMLP(**model_config)

def test_model_creation(surrogate_model, model_config):
    """Tests if the model is created with the correct dimensions."""
    assert surrogate_model.input_dim == model_config["input_dim"]
    assert surrogate_model.output_dim == model_config["output_dim"]
    
    # Check number of layers
    # Input layer + n_hidden_layers + output layer = 2 + n_hidden_layers
    # Each layer block is (Linear, ReLU) except the last one which is just Linear
    num_linear_layers = len([m for m in surrogate_model.network.modules() if isinstance(m, torch.nn.Linear)])
    assert num_linear_layers == model_config["n_hidden_layers"] + 2

def test_forward_pass(surrogate_model, model_config):
    """Tests the forward pass with a sample input tensor."""
    batch_size = 4
    input_tensor = torch.randn(batch_size, model_config["input_dim"])
    output = surrogate_model(input_tensor)
    
    assert output.shape == (batch_size, model_config["output_dim"])
    assert not torch.isnan(output).any()

def test_onnx_export_and_inference(surrogate_model, model_config, tmp_path: Path):
    """
    Tests the ONNX export functionality and verifies that the ONNX model
    produces the same output as the PyTorch model.
    """
    onnx_path = tmp_path / "surrogate.onnx"
    
    # 1. Export the model
    surrogate_model.export_onnx(str(onnx_path))
    assert onnx_path.exists()

    # 2. Create a random input
    dummy_input = torch.randn(1, model_config["input_dim"])
    
    # 3. Get PyTorch model output
    surrogate_model.eval()
    with torch.no_grad():
        pytorch_output = surrogate_model(dummy_input).numpy()

    # 4. Get ONNX Runtime session and output
    ort_session = ort.InferenceSession(str(onnx_path), providers=['CPUExecutionProvider'])
    input_name = ort_session.get_inputs()[0].name
    ort_inputs = {input_name: dummy_input.numpy()}
    onnx_output = ort_session.run(None, ort_inputs)[0]

    # 5. Compare outputs (Rule #7)
    np.testing.assert_allclose(pytorch_output, onnx_output, rtol=1e-5, atol=1e-5)

def test_invalid_output_dim():
    """Tests that an invalid output_dim raises a ValueError."""
    with pytest.raises(ValueError, match="output_dim must be a positive even number"):
        SurrogateMLP(input_dim=2, output_dim=101)
    
    with pytest.raises(ValueError, match="output_dim must be a positive even number"):
        SurrogateMLP(input_dim=2, output_dim=0)
