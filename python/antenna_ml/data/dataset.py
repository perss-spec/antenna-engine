import json
from typing import List, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

from .normalization import MinMaxNormalizer
from .simulation_data import SimulationResult


class AntennaS11Dataset(Dataset):
    """
    PyTorch Dataset for loading antenna simulation data from a JSONL file.
    It handles parameter normalization and prepares tensors for S11 prediction.
    """

    def __init__(self, data_path: str, normalizer: MinMaxNormalizer):
        self.normalizer = normalizer
        self.sim_results: List[SimulationResult] = []

        with open(data_path, "r") as f:
            for line in f:
                if line.strip():
                    data = json.loads(line)
                    self.sim_results.append(SimulationResult(**data))

    def __len__(self) -> int:
        return len(self.sim_results)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        result = self.sim_results[idx]

        # Input: Normalized parameters
        # The normalizer ensures the order and normalization
        input_tensor = torch.from_numpy(self.normalizer.transform(result.params))

        # Target: S11 curve (real and imaginary parts interleaved)
        s11_data = result.s11
        target_values = np.zeros(len(s11_data) * 2, dtype=np.float32)
        for i, c in enumerate(s11_data):
            target_values[2 * i] = c.real
            target_values[2 * i + 1] = c.imag

        target_tensor = torch.from_numpy(target_values)

        return input_tensor, target_tensor
