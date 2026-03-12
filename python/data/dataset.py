import json
from pathlib import Path
from typing import Callable, List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

from data.models import AntennaSample


class AntennaDataset(Dataset):
    """
    A PyTorch Dataset for antenna simulation data.

    Loads data from a JSONL file where each line is an AntennaSample.
    The transform functions are expected to handle the conversion from numpy array
    to torch tensor.
    """

    def __init__(
        self,
        data_path: Path,
        input_transform: Optional[Callable[[np.ndarray], torch.Tensor]] = None,
        target_transform: Optional[Callable[[np.ndarray], torch.Tensor]] = None,
    ):
        """
        Initializes the dataset.

        Args:
            data_path: Path to the JSONL file containing the dataset.
            input_transform: Optional function to apply to input parameters.
            target_transform: Optional function to apply to target results.
        """
        self.data_path = data_path
        self.input_transform = input_transform
        self.target_transform = target_transform
        self.samples: List[AntennaSample] = self._load_data()

    def _load_data(self) -> List[AntennaSample]:
        """Loads and parses samples from the JSONL file."""
        if not self.data_path.exists():
            raise FileNotFoundError(f"Data file not found at {self.data_path}")

        samples = []
        with open(self.data_path, 'r') as f:
            for line in f:
                if line.strip():
                    data = json.loads(line)
                    samples.append(AntennaSample.model_validate(data))
        return samples

    def __len__(self) -> int:
        """Returns the total number of samples in the dataset."""
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Retrieves a single sample from the dataset.

        Args:
            idx: The index of the sample to retrieve.

        Returns:
            A tuple containing the input tensor (antenna parameters) and
            the target tensor (simulation results).
        """
        sample = self.samples[idx]

        input_data = np.array([
            sample.parameters.patch_length,
            sample.parameters.patch_width,
            sample.parameters.substrate_height,
            sample.parameters.dielectric_constant,
        ], dtype=np.float32)

        target_data = np.array(sample.results.s11_db, dtype=np.float32)

        if self.input_transform:
            input_tensor = self.input_transform(input_data)
        else:
            input_tensor = torch.from_numpy(input_data)

        if self.target_transform:
            target_tensor = self.target_transform(target_data)
        else:
            target_tensor = torch.from_numpy(target_data)

        return input_tensor, target_tensor
