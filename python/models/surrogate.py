import torch
import torch.nn as nn
from typing import List


class SurrogateMLP(nn.Module):
    """
    A Multi-Layer Perceptron (MLP) to act as a surrogate model for FDTD simulations.

    This model approximates complex simulation results (e.g., S11 parameters or gain patterns)
    from a set of normalized antenna design parameters.
    """

    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        hidden_layers: int = 4,
        hidden_dim: int = 256,
    ):
        """
        Initializes the SurrogateMLP model.

        Args:
            input_dim: The number of input parameters (e.g., antenna geometry).
            output_dim: The number of output values (e.g., S11 frequency samples).
            hidden_layers: The number of hidden layers in the MLP.
            hidden_dim: The number of neurons in each hidden layer.
        """
        super().__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim

        layers: List[nn.Module] = [
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU()
        ]

        for _ in range(hidden_layers - 1):
            layers.append(nn.Linear(hidden_dim, hidden_dim))
            layers.append(nn.ReLU())

        layers.append(nn.Linear(hidden_dim, output_dim))

        self.model = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs a forward pass through the network.

        Args:
            x: Input tensor of shape (batch_size, input_dim).

        Returns:
            Output tensor of shape (batch_size, output_dim).
        """
        return self.model(x)

    def export_onnx(self, file_path: str):
        """
        Exports the model to ONNX format for use with ONNX Runtime in Rust.

        Args:
            file_path: The path to save the .onnx file.
        """
        self.eval()  # Set the model to evaluation mode for consistent export
        dummy_input = torch.randn(1, self.input_dim, requires_grad=False)

        torch.onnx.export(
            self,
            dummy_input,
            file_path,
            export_params=True,
            opset_version=14,  # A reasonably modern and supported opset
            do_constant_folding=True,
            input_names=['input_params'],
            output_names=['output_values'],
            dynamic_axes={
                'input_params': {0: 'batch_size'},
                'output_values': {0: 'batch_size'},
            },
        )
