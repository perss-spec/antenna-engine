"""Tests for antenna_ml.models.surrogate_s11.S11SurrogateModel."""

import pytest
import torch
import numpy as np
import onnxruntime as ort
import os

from antenna_ml.models.surrogate_s11 import S11SurrogateModel

INPUT_DIM = 10
OUTPUT_FREQ_POINTS = 51
OUTPUT_DIM = 2 * OUTPUT_FREQ_POINTS
HIDDEN_DIMS = [128, 256]


@pytest.fixture
def model() -> S11SurrogateModel:
    return S11SurrogateModel(
        input_dim=INPUT_DIM,
        output_dim=OUTPUT_DIM,
        hidden_dims=HIDDEN_DIMS,
    )


def test_model_initialization(model: S11SurrogateModel):
    assert model.input_dim == INPUT_DIM
    assert model.output_dim == OUTPUT_DIM
    assert isinstance(model.network, torch.nn.Sequential)
    num_layers = len(model.network)
    assert num_layers > len(HIDDEN_DIMS)


def test_forward_pass_shape(model: S11SurrogateModel):
    # Use eval mode because BatchNorm1d requires batch_size > 1 in training mode
    model.eval()

    input_tensor_single = torch.randn(1, INPUT_DIM)
    output_single = model(input_tensor_single)
    assert output_single.shape == (1, OUTPUT_DIM)

    batch_size = 32
    input_tensor_batch = torch.randn(batch_size, INPUT_DIM)
    output_batch = model(input_tensor_batch)
    assert output_batch.shape == (batch_size, OUTPUT_DIM)


def test_onnx_export_and_inference_consistency(model: S11SurrogateModel, tmp_path):
    onnx_path = tmp_path / "test_model.onnx"

    model.export_onnx(str(onnx_path))
    assert os.path.exists(onnx_path)

    batch_size = 5
    dummy_input = torch.randn(batch_size, INPUT_DIM)

    model.eval()
    with torch.no_grad():
        pytorch_output = model(dummy_input).numpy()

    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name
    onnx_output = ort_session.run(None, {input_name: dummy_input.numpy()})[0]

    np.testing.assert_allclose(pytorch_output, onnx_output, rtol=1e-5, atol=1e-5)


def test_onnx_dynamic_batch_size(model: S11SurrogateModel, tmp_path):
    onnx_path = tmp_path / "dynamic_model.onnx"

    model.export_onnx(str(onnx_path))
    assert os.path.exists(onnx_path)

    ort_session = ort.InferenceSession(str(onnx_path))
    input_name = ort_session.get_inputs()[0].name

    input_1 = np.random.randn(1, INPUT_DIM).astype(np.float32)
    output_1 = ort_session.run(None, {input_name: input_1})[0]
    assert output_1.shape == (1, OUTPUT_DIM)

    batch_size = 16
    input_16 = np.random.randn(batch_size, INPUT_DIM).astype(np.float32)
    output_16 = ort_session.run(None, {input_name: input_16})[0]
    assert output_16.shape == (batch_size, OUTPUT_DIM)
