import pytest
import torch
import numpy as np
import onnxruntime as ort

from antenna_ml.models.surrogate_mlp import SurrogateMLP


@pytest.fixture
def model_params():
    return {
        "input_dim": 5,
        "output_dim": 20,  # e.g., 10 frequency points, real+imag
        "hidden_layers": 2,
        "hidden_units": 32,
    }


def test_model_creation(model_params):
    model = SurrogateMLP(**model_params)
    assert model is not None
    assert model.input_dim == model_params["input_dim"]
    assert model.output_dim == model_params["output_dim"]


def test_forward_pass(model_params):
    model = SurrogateMLP(**model_params)
    batch_size = 4
    input_tensor = torch.randn(batch_size, model_params["input_dim"])

    output = model(input_tensor)

    assert output.shape == (batch_size, model_params["output_dim"])
    assert output.dtype == torch.float32


def test_onnx_export_and_inference_consistency(model_params, tmp_path):
    """
    CRITICAL TEST: Verifies that the ONNX model produces the same output as the
    PyTorch model, as per architectural requirements.
    """
    # 1. Create and prepare PyTorch model
    torch.manual_seed(42)  # for reproducibility
    model = SurrogateMLP(**model_params)
    model.eval()  # Set to evaluation mode

    # 2. Create dummy input
    batch_size = 1
    input_tensor = torch.randn(batch_size, model_params["input_dim"])

    # 3. Get PyTorch model output
    with torch.no_grad():
        pytorch_output = model(input_tensor).numpy()

    # 4. Export model to ONNX
    onnx_path = tmp_path / "surrogate_model.onnx"
    model.export_onnx(str(onnx_path))
    assert onnx_path.exists()

    # 5. Load ONNX model and run inference with ONNX Runtime
    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name
    ort_inputs = {input_name: input_tensor.numpy()}

    onnx_output = ort_session.run(None, ort_inputs)[0]

    # 6. Assert that outputs are numerically close (Rule #7)
    np.testing.assert_allclose(
        pytorch_output,
        onnx_output,
        rtol=1e-5,
        atol=1e-5,  # As per rule 7
        err_msg="ONNX Runtime output does not match PyTorch output.",
    )
