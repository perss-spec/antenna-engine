import torch
import numpy as np
from torch.utils.data import Dataset
from typing import List, Tuple

from antenna_ml.data.schemas import AntennaDataPoint

class AntennaDataset(Dataset):
    """
    PyTorch Dataset for antenna parameters and simulation results.
    Converts a list of Pydantic models into tensors for model training.
    """

    def __init__(self, data: List[AntennaDataPoint]):
        """
        Initializes the dataset.

        Args:
            data (List[AntennaDataPoint]): A list of data points, where each point
                                           contains antenna parameters and simulation results.
        """
        self.data = data
        self.inputs, self.labels = self._preprocess()

    def _preprocess(self) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Converts the list of Pydantic models into input and label tensors.
        """
        if not self.data:
            # Handle empty data case to avoid errors with np.array on empty list
            return torch.empty(0, 4, dtype=torch.float32), torch.empty(0, 3, dtype=torch.float32)

        inputs = []
        labels = []
        for item in self.data:
            # Input features: flatten the parameters
            input_features = [
                item.params.length,
                item.params.width,
                item.params.substrate_height,
                item.params.substrate_epsilon,
            ]
            inputs.append(input_features)

            # Output labels
            output_labels = [
                item.results.resonant_frequency,
                item.results.gain_db,
                item.results.vswr,
            ]
            labels.append(output_labels)

        # Convert to numpy arrays and then to torch tensors
        input_tensor = torch.tensor(np.array(inputs), dtype=torch.float32)
        label_tensor = torch.tensor(np.array(labels), dtype=torch.float32)

        return input_tensor, label_tensor

    def __len__(self) -> int:
        """Returns the total number of samples in the dataset."""
        return len(self.data)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Retrieves the input and label tensors for a given index.

        Args:
            idx (int): The index of the data point.

        Returns:
            A tuple containing the input tensor and the label tensor.
        """
        return self.inputs[idx], self.labels[idx]
