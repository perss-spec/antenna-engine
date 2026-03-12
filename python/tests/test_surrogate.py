import pytest
import torch
import numpy as np
import onnxruntime
from pathlib import Path

from models.surrogate import SurrogateMLP

# Model parameters for testing
INPUT_SIZE = 5
HIDDEN_SIZE = 64
OUTPUT_SIZE = 102 # 51 frequency points * 2 (real, imag)
NUM_LAYERS = 3
BATCH_SIZE = 4

@pytest.fixture
def surrogate_model() -> SurrogateMLP:
    """Fixture to create a SurrogateMLP instance."""
    return SurrogateMLP(
        input_size=INPUT_SIZE,
        hidden_size=HIDDEN_SIZE,
        output_size=OUTPUT_SIZE,
        num_hidden_layers=NUM_LAYERS
    )

def test_model_creation(surrogate_model: SurrogateMLP):
    """Test if the model is created with the correct architecture."""
    assert isinstance(surrogate_model, SurrogateMLP)
    assert len(surrogate_model.network) == (NUM_LAYERS * 2)
    assert isinstance(surrogate_model.network[0], torch.nn.Linear)
    assert surrogate_model.network[0].in_features == INPUT_SIZE
    assert surrogate_model.network[0].out_features == HIDDEN_SIZE
    assert isinstance(surrogate_model.network[-1], torch.nn.Linear)
    assert surrogate_model.network[-1].in_features == HIDDEN_SIZE
    assert surrogate_model.network[-1].out_features == OUTPUT_SIZE

def test_forward_pass(surrogate_model: SurrogateMLP):
    """Test a single forward pass."""
    input_tensor = torch.randn(BATCH_SIZE, INPUT_SIZE)
    output = surrogate_model(input_tensor)
    assert output.shape == (BATCH_SIZE, OUTPUT_SIZE)
    assert output.dtype == torch.float32

def test_onnx_export_and_inference(surrogate_model: SurrogateMLP, tmp_path: Path):
    """Test ONNX export and verify the output matches the PyTorch model."""
    onnx_path = str(tmp_path / "surrogate.onnx")
    surrogate_model.export_onnx(onnx_path, batch_size=BATCH_SIZE)

    assert Path(onnx_path).is_file()

    input_data = torch.randn(BATCH_SIZE, INPUT_SIZE)
    input_data_np = input_data.numpy()

    surrogate_model.eval()
    with torch.no_grad():
        pytorch_output = surrogate_model(input_data).numpy()

    ort_session = onnxruntime.InferenceSession(onnx_path)
    ort_inputs = {ort_session.get_inputs()[0].name: input_data_np}
    ort_outputs = ort_session.run(None, ort_inputs)
    onnx_output = ort_outputs[0]

    assert onnx_output.shape == pytorch_output.shape
    np.testing.assert_allclose(pytorch_output, onnx_output, rtol=1e-5, atol=1e-5)

def test_training_on_synthetic_data(surrogate_model: SurrogateMLP):
    """
    Test if the model can learn from a small, synthetic dataset.
    """
    num_samples = 64
    X_train = torch.rand(num_samples, INPUT_SIZE) * 2 - 1
    true_weights = torch.randn(INPUT_SIZE, OUTPUT_SIZE)
    true_bias = torch.randn(OUTPUT_SIZE)
    Y_train = X_train @ true_weights + true_bias + torch.randn(num_samples, OUTPUT_SIZE) * 0.1

    optimizer = torch.optim.Adam(surrogate_model.parameters(), lr=0.01)
    loss_fn = torch.nn.MSELoss()
    num_epochs = 10

    initial_loss = -1.0

    surrogate_model.train()
    for epoch in range(num_epochs):
        optimizer.zero_grad()
        predictions = surrogate_model(X_train)
        loss = loss_fn(predictions, Y_train)
        
        if epoch == 0:
            initial_loss = loss.item()

        loss.backward()
        optimizer.step()

        if epoch == num_epochs - 1:
            final_loss = loss.item()

    assert initial_loss > 0
    assert final_loss > 0
    assert final_loss < initial_loss
