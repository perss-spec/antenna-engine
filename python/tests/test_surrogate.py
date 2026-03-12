"""Tests for the surrogate model architecture."""

import pytest
import torch
import numpy as np
import onnxruntime
from pathlib import Path
import tempfile

from models.surrogate import SurrogateMLP

# Test parameters
INPUT_SIZE = 5
NUM_FREQ_POINTS = 101
OUTPUT_SIZE = NUM_FREQ_POINTS * 2
HIDDEN_LAYERS = 3
HIDDEN_UNITS = 64  # Smaller for faster tests


@pytest.fixture
def surrogate_model() -> SurrogateMLP:
    """Provides a default SurrogateMLP instance for testing."""
    return SurrogateMLP(
        input_size=INPUT_SIZE,
        output_size=OUTPUT_SIZE,
        hidden_layers=HIDDEN_LAYERS,
        hidden_units=HIDDEN_UNITS,
    )


def test_model_initialization(surrogate_model: SurrogateMLP):
    """Tests if the model is initialized with the correct parameters and layers."""
    assert surrogate_model.input_size == INPUT_SIZE
    assert surrogate_model.output_size == OUTPUT_SIZE
    assert surrogate_model.hidden_layers == HIDDEN_LAYERS
    assert surrogate_model.hidden_units == HIDDEN_UNITS

    num_linear_layers = sum(1 for m in surrogate_model.model if isinstance(m, torch.nn.Linear))
    assert num_linear_layers == HIDDEN_LAYERS + 1

    # Check dimensions
    assert surrogate_model.model[0].in_features == INPUT_SIZE
    assert surrogate_model.model[0].out_features == HIDDEN_UNITS
    assert surrogate_model.model[-1].in_features == HIDDEN_UNITS
    assert surrogate_model.model[-1].out_features == OUTPUT_SIZE


def test_initialization_errors():
    """Tests for ValueErrors on invalid initialization."""
    with pytest.raises(ValueError, match="hidden layers must be at least 1"):
        SurrogateMLP(input_size=5, output_size=10, hidden_layers=0)
    with pytest.raises(ValueError, match="Output size must be a positive even number"):
        SurrogateMLP(input_size=5, output_size=11, hidden_layers=2)
    with pytest.raises(ValueError, match="Output size must be a positive even number"):
        SurrogateMLP(input_size=5, output_size=0, hidden_layers=2)


def test_forward_pass_shape(surrogate_model: SurrogateMLP):
    """Tests the shape of the output tensor after a forward pass."""
    batch_size = 4
    dummy_input = torch.randn(batch_size, INPUT_SIZE)
    output = surrogate_model(dummy_input)

    assert isinstance(output, torch.Tensor)
    assert output.shape == (batch_size, OUTPUT_SIZE)


def test_predict_s11_complex_helper(surrogate_model: SurrogateMLP):
    """Tests the helper function for predicting complex S11 values."""
    batch_size = 3
    dummy_params = np.random.randn(batch_size, INPUT_SIZE)

    complex_s11 = surrogate_model.predict_s11_complex(dummy_params)

    assert isinstance(complex_s11, np.ndarray)
    assert complex_s11.dtype == np.complex128 or complex_s11.dtype == np.complex64
    assert complex_s11.shape == (batch_size, NUM_FREQ_POINTS)


def test_predict_s11_complex_single_input(surrogate_model: SurrogateMLP):
    """Tests the helper function with a single (1D) input."""
    dummy_params = np.random.randn(INPUT_SIZE)
    complex_s11 = surrogate_model.predict_s11_complex(dummy_params)
    assert complex_s11.shape == (1, NUM_FREQ_POINTS)


def test_onnx_export_and_inference_consistency(surrogate_model: SurrogateMLP):
    """
    Tests that the model can be exported to ONNX and that the ONNX model
    produces the same output as the PyTorch model.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        onnx_path = Path(tmpdir) / "test_model.onnx"
        surrogate_model.export_onnx(onnx_path)

        assert onnx_path.exists()

        # Load ONNX model
        ort_session = onnxruntime.InferenceSession(str(onnx_path))
        input_name = ort_session.get_inputs()[0].name

        # Prepare input
        batch_size = 1
        dummy_input_np = np.random.randn(batch_size, INPUT_SIZE).astype(np.float32)

        # PyTorch inference
        surrogate_model.eval()
        with torch.no_grad():
            torch_output = surrogate_model(torch.from_numpy(dummy_input_np)).numpy()

        # ONNX inference
        ort_inputs = {input_name: dummy_input_np}
        ort_output = ort_session.run(None, ort_inputs)[0]

        # Compare outputs
        np.testing.assert_allclose(torch_output, ort_output, rtol=1e-5, atol=1e-5)


def test_onnx_dynamic_batch_size(surrogate_model: SurrogateMLP):
    """
    Tests that the exported ONNX model can handle dynamic batch sizes.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        onnx_path = Path(tmpdir) / "dynamic_model.onnx"
        surrogate_model.export_onnx(onnx_path)

        ort_session = onnxruntime.InferenceSession(str(onnx_path))
        input_name = ort_session.get_inputs()[0].name

        # Test with batch size 1
        input_bs1 = np.random.randn(1, INPUT_SIZE).astype(np.float32)
        output_bs1 = ort_session.run(None, {input_name: input_bs1})[0]
        assert output_bs1.shape == (1, OUTPUT_SIZE)

        # Test with batch size 8
        input_bs8 = np.random.randn(8, INPUT_SIZE).astype(np.float32)
        output_bs8 = ort_session.run(None, {input_name: input_bs8})[0]
        assert output_bs8.shape == (8, OUTPUT_SIZE)
