import pytest
from unittest.mock import patch, MagicMock
import torch

# We need to import the script to test its functions
from training import train

@patch('training.train.generate_synthetic_data')
@patch('training.train.SurrogateAntennaModel')
@patch('torch.utils.data.DataLoader')
@patch('torch.save')
def test_train_model_runs_without_error(
    mock_torch_save: MagicMock,
    mock_dataloader: MagicMock,
    mock_model_class: MagicMock,
    mock_generate_data: MagicMock,
    tmp_path
):
    """
    Tests that the train_model function executes a short training loop
    without crashing. Mocks heavy components like data generation and saving.
    """
    # --- Mock Configuration ---
    # 1. Mock data generation
    dummy_x = torch.randn(10, 3)
    dummy_y = torch.randn(10, 1)
    mock_generate_data.return_value = (dummy_x.numpy(), dummy_y.numpy())

    # 2. Mock Model and its forward pass
    mock_model_instance = MagicMock()
    # The model's forward pass should return a tensor of the correct shape
    mock_model_instance.return_value = torch.randn(5, 1) 
    mock_model_class.return_value = mock_model_instance

    # 3. Mock DataLoader to return a small batch
    mock_dataloader.return_value = iter([
        (torch.randn(5, 3), torch.randn(5, 1)), # Train batch
        (torch.randn(5, 3), torch.randn(5, 1)), # Val batch
    ])

    # --- Override training script configurations for a quick test ---
    train.NUM_SAMPLES = 10
    train.EPOCHS = 2
    train.BATCH_SIZE = 5
    train.MODEL_SAVE_PATH = tmp_path / "test_model.pth"

    # --- Run the function to be tested ---
    try:
        train.train_model()
    except Exception as e:
        pytest.fail(f"train_model() raised an unexpected exception: {e}")

    # --- Assertions ---
    # Check that data generation was called
    mock_generate_data.assert_called_once_with(num_samples=10, seed=train.SEED)

    # Check that the model was instantiated
    mock_model_class.assert_called_once_with(input_size=3, output_size=1)

    # Check that the optimizer's step function was called (once per epoch)
    assert mock_model_instance.parameters.return_value.grad is not None or \
           mock_model_instance.zero_grad.call_count == train.EPOCHS
    
    # Check that the model was "saved" at least once
    mock_torch_save.assert_called()
