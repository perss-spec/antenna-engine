import torch
import pytest

from antenna_ml.data.schemas import AntennaParameters, SimulationOutput, AntennaDataPoint
from antenna_ml.data.dataset import AntennaDataset

@pytest.fixture
def sample_data_points():
    """Provides a list of sample AntennaDataPoint objects for testing."""
    return [
        AntennaDataPoint(
            params=AntennaParameters(length=0.05, width=0.04, substrate_height=0.0015, substrate_epsilon=4.4),
            results=SimulationOutput(resonant_frequency=2.4e9, gain_db=3.1, vswr=1.5)
        ),
        AntennaDataPoint(
            params=AntennaParameters(length=0.048, width=0.038, substrate_height=0.0015, substrate_epsilon=4.4),
            results=SimulationOutput(resonant_frequency=2.45e9, gain_db=3.0, vswr=1.4)
        ),
        AntennaDataPoint(
            params=AntennaParameters(length=0.02, width=0.015, substrate_height=0.0008, substrate_epsilon=2.2),
            results=SimulationOutput(resonant_frequency=5.8e9, gain_db=4.5, vswr=1.2)
        ),
    ]

def test_antenna_dataset_initialization(sample_data_points):
    """Tests the initialization and length of the AntennaDataset."""
    dataset = AntennaDataset(data=sample_data_points)
    assert len(dataset) == 3, "Dataset length should match the number of input data points."

def test_antenna_dataset_getitem(sample_data_points):
    """Tests if __getitem__ returns tensors with the correct shape and type."""
    dataset = AntennaDataset(data=sample_data_points)
    
    # Check the first item
    inputs, labels = dataset[0]
    
    assert isinstance(inputs, torch.Tensor), "Inputs should be a torch.Tensor."
    assert inputs.dtype == torch.float32, "Input tensor should have dtype float32."
    assert inputs.shape == (4,), "Input tensor should have 4 features."
    
    assert isinstance(labels, torch.Tensor), "Labels should be a torch.Tensor."
    assert labels.dtype == torch.float32, "Label tensor should have dtype float32."
    assert labels.shape == (3,), "Label tensor should have 3 target values."

def test_antenna_dataset_tensor_content(sample_data_points):
    """Tests the content of the tensors created by the dataset."""
    dataset = AntennaDataset(data=sample_data_points)
    
    # Test first data point
    expected_inputs_0 = torch.tensor([0.05, 0.04, 0.0015, 4.4], dtype=torch.float32)
    expected_labels_0 = torch.tensor([2.4e9, 3.1, 1.5], dtype=torch.float32)
    
    actual_inputs_0, actual_labels_0 = dataset[0]
    
    assert torch.allclose(actual_inputs_0, expected_inputs_0), "Input tensor content mismatch for the first item."
    assert torch.allclose(actual_labels_0, expected_labels_0), "Label tensor content mismatch for the first item."

    # Test third data point
    expected_inputs_2 = torch.tensor([0.02, 0.015, 0.0008, 2.2], dtype=torch.float32)
    expected_labels_2 = torch.tensor([5.8e9, 4.5, 1.2], dtype=torch.float32)

    actual_inputs_2, actual_labels_2 = dataset[2]

    assert torch.allclose(actual_inputs_2, expected_inputs_2), "Input tensor content mismatch for the third item."
    assert torch.allclose(actual_labels_2, expected_labels_2), "Label tensor content mismatch for the third item."

def test_antenna_dataset_empty_input():
    """Tests the dataset behavior with an empty list of data."""
    dataset = AntennaDataset(data=[])
    assert len(dataset) == 0
    assert dataset.inputs.shape == (0, 4)
    assert dataset.labels.shape == (0, 3)
