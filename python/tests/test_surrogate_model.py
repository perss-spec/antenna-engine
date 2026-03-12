"""Tests for the S11SurrogateModel."""

import pytest
import torch
import numpy as np
import onnxruntime as ort
import os

from models.surrogate import S11SurrogateModel

# Test constants
INPUT_DIM = 10
OUTPUT_FREQ_POINTS = 51
HIDDEN_LAYERS = [128, 256]

@pytest.fixture
def model() -> S11SurrogateModel:
    """Provides a default S11SurrogateModel instance for tests."""
    return S11SurrogateModel(
        input_dim=INPUT_DIM,
        output_freq_points=OUTPUT_FREQ_POINTS,
        hidden_layers=HIDDEN_LAYERS
    )

def test_model_initialization(model: S11SurrogateModel):
    """Tests if the model is initialized with the correct parameters."""
    assert model.input_dim == INPUT_DIM
    assert model.output_freq_points == OUTPUT_FREQ_POINTS
    assert model.hidden_layers_config == HIDDEN_LAYERS
    assert model.output_dim == 2 * OUTPUT_FREQ_POINTS
    assert isinstance(model.network, torch.nn.Sequential)
    num_layers = len(model.network)
    assert num_layers > len(HIDDEN_LAYERS)

def test_initialization_errors():
    """Tests that the model raises errors on invalid initialization parameters."""
    with pytest.raises(ValueError):
        S11SurrogateModel(input_dim=0, output_freq_points=51)
    with pytest.raises(ValueError):
        S11SurrogateModel(input_dim=-5, output_freq_points=51)
    with pytest.raises(ValueError):
        S11SurrogateModel(input_dim=10, output_freq_points=0)
    with pytest.raises(ValueError):
        S11SurrogateModel(input_dim=10, output_freq_points=-10)
    with pytest.raises(ValueError):
        S11SurrogateModel(input_dim=10, output_freq_points=51, hidden_layers=[128, 0])
    with pytest.raises(ValueError):
        S11SurrogateModel(input_dim=10, output_freq_points=51, hidden_layers="not a list")

def test_forward_pass_shape(model: S11SurrogateModel):
    """Tests the output shape of the forward pass for different batch sizes."""
    input_tensor_single = torch.randn(1, INPUT_DIM)
    output_single = model(input_tensor_single)
    assert output_single.shape == (1, 2 * OUTPUT_FREQ_POINTS)

    batch_size = 32
    input_tensor_batch = torch.randn(batch_size, INPUT_DIM)
    output_batch = model(input_tensor_batch)
    assert output_batch.shape == (batch_size, 2 * OUTPUT_FREQ_POINTS)

def test_predict_s11_complex_helper(model: S11SurrogateModel):
    """Tests the complex prediction helper function."""
    batch_size = 4
    input_tensor = torch.randn(batch_size, INPUT_DIM)
    
    raw_output = model(input_tensor)
    complex_output = model.predict_s11_complex(input_tensor)
    
    assert complex_output.dtype == torch.complex64
    assert complex_output.shape == (batch_size, OUTPUT_FREQ_POINTS)
    
    expected_real = raw_output[:, :OUTPUT_FREQ_POINTS]
    expected_imag = raw_output[:, OUTPUT_FREQ_POINTS:]
    
    assert torch.allclose(complex_output.real, expected_real)
    assert torch.allclose(complex_output.imag, expected_imag)

def test_onnx_export_and_inference_consistency(model: S11SurrogateModel, tmp_path):
    """
    Tests that the model can be exported to ONNX and that the ONNX model
    produces the same output as the PyTorch model.
    """
    onnx_path = tmp_path / "test_model.onnx"
    batch_size = 5
    dummy_input = torch.randn(batch_size, INPUT_DIM)
    
    model.export_onnx(str(onnx_path), dummy_input=dummy_input)
    assert os.path.exists(onnx_path)
    
    model.eval()
    with torch.no_grad():
        pytorch_output = model(dummy_input).numpy()
        
    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name
    onnx_output = ort_session.run(None, {input_name: dummy_input.numpy()})[0]
    
    np.testing.assert_allclose(pytorch_output, onnx_output, rtol=1e-5, atol=1e-5)

def test_onnx_dynamic_batch_size(model: S11SurrogateModel, tmp_path):
    """
    Tests that the exported ONNX model supports dynamic batch sizes.
    """
    onnx_path = tmp_path / "dynamic_model.onnx"
    
    model.export_onnx(str(onnx_path))
    assert os.path.exists(onnx_path)
    
    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name
    
    input_1 = np.random.randn(1, INPUT_DIM).astype(np.float32)
    output_1 = ort_session.run(None, {input_name: input_1})[0]
    assert output_1.shape == (1, 2 * OUTPUT_FREQ_POINTS)
    
    batch_size = 16
    input_16 = np.random.randn(batch_size, INPUT_DIM).astype(np.float32)
    output_16 = ort_session.run(None, {input_name: input_16})[0]
    assert output_16.shape == (batch_size, 2 * OUTPUT_FREQ_POINTS)
