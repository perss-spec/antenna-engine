import torch
import torch.nn as nn
from typing import List


class SurrogateMLP(nn.Module):
    """
    A Multi-Layer Perceptron (MLP) surrogate model to approximate antenna simulation results.
    """

    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        hidden_layers: int = 3,
        hidden_units: int = 256,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim

        layers: List[nn.Module] = []

        # Input layer
        layers.append(nn.Linear(input_dim, hidden_units))
        layers.append(nn.ReLU())

        # Hidden layers
        for _ in range(hidden_layers):
            layers.append(nn.Linear(hidden_units, hidden_units))
            layers.append(nn.ReLU())

        # Output layer
        layers.append(nn.Linear(hidden_units, output_dim))

        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs a forward pass through the network.

        Args:
            x: Input tensor of shape (batch_size, input_dim) with normalized parameters.

        Returns:
            Output tensor of shape (batch_size, output_dim).
        """
        return self.network(x)

    def export_onnx(self, path: str):
        """
        Exports the model to ONNX format.

        Args:
            path: The file path to save the .onnx model.
        """
        # Create a dummy input tensor for tracing
        dummy_input = torch.randn(1, self.input_dim, requires_grad=True)
        self.eval()  # Set model to evaluation mode

        torch.onnx.export(
            self,
            dummy_input,
            path,
            export_params=True,
            opset_version=12,  # A reasonably modern and stable opset
            do_constant_folding=True,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={
                "input": {0: "batch_size"},
                "output": {0: "batch_size"},
            },
        )
