import torch
import torch.nn as nn
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple

class BaseSurrogateModel(ABC, nn.Module):
    """
    Abstract base class for all surrogate models.
    Defines the interface for training, prediction, and ONNX export.
    """

    def __init__(
        self,
        param_names: List[str],
        param_mean: torch.Tensor,
        param_std: torch.Tensor,
        freq_ghz: torch.Tensor,
    ):
        super().__init__()
        if not isinstance(param_names, list):
            raise TypeError("param_names must be a list of strings.")
        if not all(isinstance(p, str) for p in param_names):
            raise TypeError("All elements in param_names must be strings.")

        self.param_names = param_names
        self.register_buffer('param_mean', param_mean)
        self.register_buffer('param_std', param_std)
        self.register_buffer('freq_ghz', freq_ghz)

    def normalize_params(self, params: Dict[str, float]) -> torch.Tensor:
        """
        Converts a dictionary of real-world parameters to a normalized tensor.
        """
        if sorted(params.keys()) != sorted(self.param_names):
            raise ValueError(
                f"Input params keys {list(params.keys())} do not match "
                f"model param names {self.param_names}"
            )
        
        # Ensure order is consistent
        ordered_params = torch.tensor([params[name] for name in self.param_names], dtype=torch.float32)
        
        # Add batch dimension
        ordered_params = ordered_params.unsqueeze(0)

        normalized = (ordered_params - self.param_mean) / self.param_std
        return normalized

    def denormalize_params(self, norm_params: torch.Tensor) -> Dict[str, float]:
        """
        Converts a normalized tensor back to a dictionary of real-world parameters.
        Assumes a single item in the batch.
        """
        if norm_params.ndim != 2 or norm_params.shape[0] != 1:
            raise ValueError("Input tensor must have shape (1, num_params)")

        denormalized = norm_params * self.param_std + self.param_mean
        
        # Remove batch dimension
        denormalized = denormalized.squeeze(0)

        return {name: val.item() for name, val in zip(self.param_names, denormalized)}

    @abstractmethod
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        The forward pass of the model.
        Takes a batch of normalized parameters and returns model predictions.
        """
        pass

    def predict(self, params: Dict[str, float]) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        High-level prediction function for a single set of real-world parameters.
        Returns frequencies and corresponding S11 values in dB.
        """
        self.eval()  # Set model to evaluation mode
        with torch.no_grad():
            norm_params_tensor = self.normalize_params(params)
            # The model's forward pass should return the S11 dB values
            s11_db = self.forward(norm_params_tensor)
        return self.freq_ghz, s11_db.squeeze(0)

    @abstractmethod
    def export_onnx(self, path: str):
        """
        Exports the model to ONNX format.
        """
        pass
