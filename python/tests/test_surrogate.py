import os
import sys
import pytest
import torch
import numpy as np
import onnxruntime as ort

# Ensure the project root is in the Python path for module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models.surrogate import SurrogateMLP


@pytest.fixture
def model_config():
    """Provides a standard configuration for the surrogate model for tests."""
    return {
        "input_dim": 5,       # e.g., 5 geometric parameters
        "output_dim": 101,    # e.g., 101 S11 frequency points
        "hidden_layers": 3,
        "hidden_dim": 64,     # Smaller dimension for faster tests
    }


@pytest.fixture
def surrogate_model(model_config):
    """Creates an instance of the SurrogateMLP for testing."""
    return SurrogateMLP(**model_config)


def test_model_instantiation(surrogate_model, model_config):
    """Tests if the model can be instantiated correctly with given parameters."""
    assert isinstance(surrogate_model, SurrogateMLP)
    assert surrogate_model.input_dim == model_config["input_dim"]
    assert surrogate_model.output_dim == model_config["output_dim"]
    # Check if the number of layers is roughly correct (Linear + ReLU pairs + final Linear)
    assert len(list(surrogate_model.model.children())) == 2 * model_config["hidden_layers"]


def test_forward_pass(surrogate_model, model_config):
    """Tests the forward pass of the model with a sample batch of data."""
    batch_size = 4
    input_tensor = torch.randn(batch_size, model_config["input_dim"])
    output = surrogate_model(input_tensor)
    assert output.shape == (batch_size, model_config["output_dim"])
    assert output.dtype == torch.float32


def test_onnx_export_and_inference_consistency(surrogate_model, model_config, tmp_path):
    """
    Tests the ONNX export and verifies that the ONNX model's output is numerically
    consistent with the PyTorch model's output (Rule #7).
    """
    onnx_path = tmp_path / "surrogate.onnx"

    # 1. Export the model to ONNX format
    try:
        surrogate_model.export_onnx(str(onnx_path))
    except Exception as e:
        pytest.fail(f"ONNX export failed with an exception: {e}")

    assert os.path.exists(onnx_path), "ONNX file was not created."
    assert os.path.getsize(onnx_path) > 0, "ONNX file is empty."

    # 2. Prepare a test input tensor
    dummy_input = torch.randn(1, model_config["input_dim"])

    # 3. Get the output from the PyTorch model
    surrogate_model.eval()  # Set to evaluation mode for consistent results
    with torch.no_grad():
        pytorch_output = surrogate_model(dummy_input).numpy()

    # 4. Get the output from the ONNX Runtime session
    try:
        ort_session = ort.InferenceSession(str(onnx_path))
        input_name = ort_session.get_inputs()[0].name
        output_name = ort_session.get_outputs()[0].name
        onnx_output = ort_session.run([output_name], {input_name: dummy_input.numpy()})[0]
    except Exception as e:
        pytest.fail(f"ONNX Runtime inference failed: {e}")

    # 5. Compare outputs to ensure they are almost identical
    np.testing.assert_allclose(pytorch_output, onnx_output, rtol=1e-5, atol=1e-5)


def test_onnx_batch_inference(surrogate_model, model_config, tmp_path):
    """
    Tests ONNX inference with a batch size > 1 to ensure dynamic axes are working.
    """
    onnx_path = tmp_path / "surrogate_batch.onnx"
    surrogate_model.export_onnx(str(onnx_path))

    batch_size = 8
    dummy_input = torch.randn(batch_size, model_config["input_dim"])

    surrogate_model.eval()
    with torch.no_grad():
        pytorch_output = surrogate_model(dummy_input).numpy()

    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name

    onnx_output = ort_session.run([output_name], {input_name: dummy_input.numpy()})[0]

    assert onnx_output.shape == (batch_size, model_config["output_dim"])
    np.testing.assert_allclose(pytorch_output, onnx_output, rtol=1e-5, atol=1e-5)
