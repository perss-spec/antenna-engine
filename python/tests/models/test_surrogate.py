import pytest
import torch
import numpy as np
import onnxruntime as ort
from pathlib import Path

from models.surrogate import SurrogateMLP


@pytest.fixture
def model_config():
    return {
        "input_dim": 5,
        "output_dim": 202,  # 101 frequency points, interleaved
        "hidden_dim": 64,
        "n_hidden_layers": 2,
    }


def test_model_creation(model_config):
    """Tests that the model can be instantiated correctly."""
    model = SurrogateMLP(**model_config)
    assert model is not None
    assert model.input_dim == model_config["input_dim"]
    assert model.output_dim == model_config["output_dim"]


def test_model_creation_invalid_output_dim():
    """Tests that an error is raised for an odd output dimension."""
    with pytest.raises(ValueError, match="output_dim must be a positive even number"):
        SurrogateMLP(input_dim=5, output_dim=101)


def test_forward_pass(model_config):
    """Tests the forward pass with a batch of data."""
    model = SurrogateMLP(**model_config)
    batch_size = 8
    input_tensor = torch.randn(batch_size, model_config["input_dim"])

    output = model(input_tensor)

    assert output.shape == (batch_size, model_config["output_dim"])
    assert output.dtype == torch.float32


def test_onnx_export_and_inference_consistency(model_config, tmp_path: Path):
    """
    CRITICAL TEST: Verifies that the ONNX model produces the same output as the
    PyTorch model, as per architectural requirements (Rule #7).
    """
    torch.manual_seed(42)
    model = SurrogateMLP(**model_config)
    model.eval()  # Set to evaluation mode

    # Create dummy input
    input_tensor = torch.randn(1, model_config["input_dim"])

    # Get PyTorch model output
    with torch.no_grad():
        pytorch_output = model(input_tensor).numpy()

    # Export model to ONNX
    onnx_path = tmp_path / "surrogate.onnx"
    model.export_onnx(str(onnx_path))
    assert onnx_path.exists()

    # Load ONNX model and run inference with ONNX Runtime
    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name
    ort_inputs = {input_name: input_tensor.numpy()}

    onnx_output = ort_session.run([output_name], ort_inputs)[0]

    # Assert that outputs are numerically close
    np.testing.assert_allclose(
        pytorch_output,
        onnx_output,
        rtol=1e-5,
        atol=1e-5,  # As per rule 7
        err_msg="ONNX Runtime output does not match PyTorch output.",
    )
