import torch
import pytest

from data.models import AntennaParameters, SimulationResult, TrainingSample
from data.dataset import AntennaDataset

@pytest.fixture
def dummy_training_samples():
    """Creates a list of dummy TrainingSample objects for testing."""
    samples = []
    for i in range(10):
        params = AntennaParameters(
            patch_length=30.0 + i,
            patch_width=40.0 + i,
            substrate_height=1.5,
            substrate_epsilon=4.4
        )
        result = SimulationResult(
            frequencies_ghz=[2.4, 2.5, 2.6],
            s11_db=[-10.0 - i, -15.0 - i, -12.0 - i]
        )
        samples.append(TrainingSample(parameters=params, result=result))
    return samples

def test_antenna_dataset_len(dummy_training_samples):
    dataset = AntennaDataset(samples=dummy_training_samples)
    assert len(dataset) == 10

def test_antenna_dataset_getitem(dummy_training_samples):
    dataset = AntennaDataset(samples=dummy_training_samples)
    input_tensor, output_tensor = dataset[0]

    # Check types
    assert isinstance(input_tensor, torch.Tensor)
    assert isinstance(output_tensor, torch.Tensor)
    assert input_tensor.dtype == torch.float32
    assert output_tensor.dtype == torch.float32

    # Check shapes
    assert input_tensor.shape == (4,) # 4 parameters
    assert output_tensor.shape == (3,) # 3 frequency points

    # Check values
    expected_input = torch.tensor([30.0, 40.0, 1.5, 4.4], dtype=torch.float32)
    expected_output = torch.tensor([-10.0, -15.0, -12.0], dtype=torch.float32)
    assert torch.allclose(input_tensor, expected_input)
    assert torch.allclose(output_tensor, expected_output)

def test_antenna_dataset_dims(dummy_training_samples):
    dataset = AntennaDataset(samples=dummy_training_samples)
    assert dataset.input_dim == 4
    assert dataset.output_dim == 3

def test_empty_dataset():
    dataset = AntennaDataset(samples=[])
    assert len(dataset) == 0
    assert dataset.input_dim == 0
    assert dataset.output_dim == 0
