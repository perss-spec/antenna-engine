"""Tests for the models.surrogate.SurrogateMLP architecture."""

import pytest
import torch
import numpy as np
import onnxruntime
from pathlib import Path
import tempfile

from models.surrogate import SurrogateMLP

INPUT_DIM = 5
NUM_FREQ_POINTS = 101
OUTPUT_DIM = NUM_FREQ_POINTS * 2
N_HIDDEN_LAYERS = 3
HIDDEN_DIM = 64


@pytest.fixture
def surrogate_model() -> SurrogateMLP:
    return SurrogateMLP(
        input_dim=INPUT_DIM,
        output_dim=OUTPUT_DIM,
        hidden_dim=HIDDEN_DIM,
        n_hidden_layers=N_HIDDEN_LAYERS,
    )


def test_model_initialization(surrogate_model: SurrogateMLP):
    assert surrogate_model.input_dim == INPUT_DIM
    assert surrogate_model.output_dim == OUTPUT_DIM

    num_linear_layers = sum(
        1 for m in surrogate_model.network if isinstance(m, torch.nn.Linear)
    )
    # input->hidden + n_hidden_layers * hidden->hidden + hidden->output
    assert num_linear_layers == N_HIDDEN_LAYERS + 2

    assert surrogate_model.network[0].in_features == INPUT_DIM
    assert surrogate_model.network[0].out_features == HIDDEN_DIM
    assert surrogate_model.network[-1].out_features == OUTPUT_DIM


def test_initialization_invalid_output_dim():
    with pytest.raises(ValueError):
        SurrogateMLP(input_dim=5, output_dim=11)
    with pytest.raises(ValueError):
        SurrogateMLP(input_dim=5, output_dim=0)


def test_forward_pass_shape(surrogate_model: SurrogateMLP):
    batch_size = 4
    dummy_input = torch.randn(batch_size, INPUT_DIM)
    output = surrogate_model(dummy_input)
    assert isinstance(output, torch.Tensor)
    assert output.shape == (batch_size, OUTPUT_DIM)


def test_onnx_export_and_inference_consistency(surrogate_model: SurrogateMLP):
    with tempfile.TemporaryDirectory() as tmpdir:
        onnx_path = Path(tmpdir) / "test_model.onnx"
        surrogate_model.export_onnx(str(onnx_path))
        assert onnx_path.exists()

        ort_session = onnxruntime.InferenceSession(str(onnx_path))
        input_name = ort_session.get_inputs()[0].name

        batch_size = 1
        dummy_input_np = np.random.randn(batch_size, INPUT_DIM).astype(np.float32)

        surrogate_model.eval()
        with torch.no_grad():
            torch_output = surrogate_model(torch.from_numpy(dummy_input_np)).numpy()

        ort_inputs = {input_name: dummy_input_np}
        ort_output = ort_session.run(None, ort_inputs)[0]

        np.testing.assert_allclose(torch_output, ort_output, rtol=1e-5, atol=1e-5)


def test_onnx_dynamic_batch_size(surrogate_model: SurrogateMLP):
    with tempfile.TemporaryDirectory() as tmpdir:
        onnx_path = Path(tmpdir) / "dynamic_model.onnx"
        surrogate_model.export_onnx(str(onnx_path))

        ort_session = onnxruntime.InferenceSession(str(onnx_path))
        input_name = ort_session.get_inputs()[0].name

        input_bs1 = np.random.randn(1, INPUT_DIM).astype(np.float32)
        output_bs1 = ort_session.run(None, {input_name: input_bs1})[0]
        assert output_bs1.shape == (1, OUTPUT_DIM)

        input_bs8 = np.random.randn(8, INPUT_DIM).astype(np.float32)
        output_bs8 = ort_session.run(None, {input_name: input_bs8})[0]
        assert output_bs8.shape == (8, OUTPUT_DIM)
