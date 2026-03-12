import torch
import torch.nn as nn
from typing import List


class SurrogateMLP(nn.Module):
    """
    A Multi-Layer Perceptron (MLP) surrogate model to approximate antenna simulations.

    This model takes a set of normalized antenna parameters as input and predicts
    the S11 scattering parameter curve over a range of frequencies.

    The output is a flattened tensor of real and imaginary parts of the S11 curve.
    For N frequency points, the output size is 2*N. The structure is:
    [re_1, re_2, ..., re_N, im_1, im_2, ..., im_N]
    """

    def __init__(
        self,
        input_dim: int,
        output_dim: int,  # Should be 2 * num_frequency_points
        hidden_dim: int = 256,
        n_hidden_layers: int = 4,
    ):
        """
        Initializes the MLP model.

        Args:
            input_dim: The number of input antenna parameters.
            output_dim: The size of the output vector (2 * num_frequency_points).
            hidden_dim: The number of units in each hidden layer.
            n_hidden_layers: The number of hidden layers.
        """
        super().__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim

        layers: List[nn.Module] = [nn.Linear(input_dim, hidden_dim), nn.ReLU()]

        for _ in range(n_hidden_layers):
            layers.extend([nn.Linear(hidden_dim, hidden_dim), nn.ReLU()])

        # Final output layer
        layers.append(nn.Linear(hidden_dim, output_dim))

        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs the forward pass of the model.

        Args:
            x: A tensor of shape (batch_size, input_dim) containing
               normalized antenna parameters.

        Returns:
            A tensor of shape (batch_size, output_dim) representing the
            flattened real and imaginary parts of the S11 curve.
        """
        return self.network(x)

    def export_onnx(self, path: str):
        """
        Exports the model to ONNX format for use with ONNX Runtime.

        Args:
            path: The file path to save the .onnx model.
        """
        # Create a dummy input tensor with the correct shape for tracing.
        # The batch size is typically set to 1 for export, but we use dynamic axes.
        dummy_input = torch.randn(1, self.input_dim, device=next(self.parameters()).device)

        # Set the model to evaluation mode (important for layers like dropout, batchnorm)
        self.eval()

        print(f"Exporting model to ONNX at {path}...")
        torch.onnx.export(
            self,
            dummy_input,
            path,
            export_params=True,
            opset_version=14,  # A reasonably modern opset version
            do_constant_folding=True,
            input_names=['antenna_params'],
            output_names=['s11_real_imag'],
            dynamic_axes={
                'antenna_params': {0: 'batch_size'},
                's11_real_imag': {0: 'batch_size'}
            }
        )
        print(f"Model successfully exported to {path}")
