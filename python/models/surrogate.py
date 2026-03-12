"""Surrogate models for approximating antenna simulation results."""

import torch
import torch.nn as nn
import numpy as np
from typing import List, Optional


class S11SurrogateModel(nn.Module):
    """
    A surrogate model to predict S11 parameters for an antenna.

    This model uses a Multi-Layer Perceptron (MLP) to approximate the
    results of an FDTD simulation. It takes normalized antenna design
    parameters as input and predicts the complex S11 values across a
    range of frequencies.
    """

    def __init__(
        self,
        input_dim: int,
        output_freq_points: int,
        hidden_layers: List[int] = [256, 512, 256],
        dropout_rate: float = 0.1,
    ):
        """
        Initializes the S11SurrogateModel.

        Args:
            input_dim (int): The number of input features (normalized antenna parameters).
            output_freq_points (int): The number of frequency points for the S11 output.
            hidden_layers (List[int]): A list of integers specifying the size of each hidden layer.
            dropout_rate (float): The dropout rate to use for regularization.
        """
        super().__init__()

        if not isinstance(input_dim, int) or input_dim <= 0:
            raise ValueError("input_dim must be a positive integer.")
        if not isinstance(output_freq_points, int) or output_freq_points <= 0:
            raise ValueError("output_freq_points must be a positive integer.")
        if not isinstance(hidden_layers, list) or not all(isinstance(i, int) and i > 0 for i in hidden_layers):
            raise ValueError("hidden_layers must be a list of positive integers.")

        self.input_dim = input_dim
        self.output_freq_points = output_freq_points
        self.hidden_layers_config = hidden_layers
        self.dropout_rate = dropout_rate

        layers = []
        current_dim = input_dim
        for hidden_dim in hidden_layers:
            layers.append(nn.Linear(current_dim, hidden_dim))
            layers.append(nn.ReLU())
            if dropout_rate > 0:
                layers.append(nn.Dropout(dropout_rate))
            current_dim = hidden_dim

        # Output layer predicts real and imaginary parts for each frequency point
        self.output_dim = 2 * output_freq_points
        layers.append(nn.Linear(current_dim, self.output_dim))

        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs the forward pass of the model.

        Args:
            x (torch.Tensor): The input tensor of shape (batch_size, input_dim).

        Returns:
            torch.Tensor: The output tensor of shape (batch_size, 2 * output_freq_points),
                          representing the concatenated real and imaginary parts of S11.
        """
        return self.network(x)

    def predict_s11_complex(self, x: torch.Tensor) -> torch.Tensor:
        """
        Predicts S11 as a complex tensor.

        Args:
            x (torch.Tensor): The input tensor of shape (batch_size, input_dim).

        Returns:
            torch.Tensor: The complex S11 output tensor of shape (batch_size, output_freq_points).
        """
        self.eval()  # Set the model to evaluation mode
        with torch.no_grad():
            output = self.forward(x)
            real_part = output[:, :self.output_freq_points]
            imag_part = output[:, self.output_freq_points:]
            return torch.complex(real_part, imag_part)

    def export_onnx(self, path: str, dummy_input: Optional[torch.Tensor] = None):
        """
        Exports the model to ONNX format.

        Args:
            path (str): The path to save the .onnx file.
            dummy_input (Optional[torch.Tensor]): A dummy input tensor for tracing.
                If None, a default tensor of shape (1, input_dim) is created.
        """
        if dummy_input is None:
            # Create a dummy input with a dynamic batch size axis
            dummy_input = torch.randn(1, self.input_dim, requires_grad=True)

        self.eval()  # Set the model to evaluation mode for export

        # Define dynamic axes for variable batch size
        dynamic_axes = {'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}

        torch.onnx.export(
            self,
            dummy_input,
            path,
            export_params=True,
            opset_version=14,  # A reasonably modern opset version
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes=dynamic_axes
        )
