import torch
from torch.utils.data import Dataset
from typing import List
import numpy as np

from .models import TrainingSample

class AntennaDataset(Dataset):
    """
    PyTorch Dataset for antenna simulation data.
    Converts a list of TrainingSample objects into tensors for model training.
    """
    def __init__(self, samples: List[TrainingSample]):
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Returns a single training pair (input_tensor, output_tensor).
        """
        sample = self.samples[idx]

        # Input tensor: concatenated antenna parameters
        input_params = sample.parameters
        input_tensor = torch.tensor([
            input_params.patch_length,
            input_params.patch_width,
            input_params.substrate_height,
            input_params.substrate_epsilon
        ], dtype=torch.float32)

        # Output tensor: S11 values
        # Note: Frequencies are assumed to be fixed across the dataset for this simple model
        output_tensor = torch.tensor(sample.result.s11_db, dtype=torch.float32)

        return input_tensor, output_tensor

    @property
    def input_dim(self) -> int:
        """Returns the dimension of the input feature vector."""
        if not self.samples:
            return 0
        # Based on the number of fields in AntennaParameters
        return len(self.samples[0].parameters.model_fields)

    @property
    def output_dim(self) -> int:
        """Returns the dimension of the output vector."""
        if not self.samples:
            return 0
        # Based on the length of the S11 dB vector
        return len(self.samples[0].result.s11_db)
