import torch
import torch.nn as nn
from typing import List

class SurrogateMLP(nn.Module):
    """
    A simple Multi-Layer Perceptron (MLP) to act as a surrogate model for
    antenna FDTD simulations.

    It predicts S11 curves from a set of antenna geometric parameters.
    """
    def __init__(self, input_size: int, hidden_size: int, output_size: int, num_hidden_layers: int = 3):
        """
        Initializes the SurrogateMLP model.

        Args:
            input_size (int): The number of input antenna parameters.
            hidden_size (int): The number of neurons in each hidden layer.
            output_size (int): The number of output values. For S11, this is
                               num_frequency_points * 2 (real and imaginary parts).
            num_hidden_layers (int): The number of hidden layers.
        """
        super().__init__()
        self.input_size = input_size
        self.output_size = output_size

        layers: List[nn.Module] = [nn.Linear(input_size, hidden_size), nn.ReLU()]

        for _ in range(num_hidden_layers - 1):
            layers.extend([nn.Linear(hidden_size, hidden_size), nn.ReLU()])

        layers.append(nn.Linear(hidden_size, output_size))

        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs a forward pass through the network.

        Args:
            x (torch.Tensor): A batch of input parameters, shape (batch_size, input_size).

        Returns:
            torch.Tensor: The predicted S11 curves, shape (batch_size, output_size).
        """
        return self.network(x)

    def export_onnx(self, path: str, batch_size: int = 1):
        """
        Exports the model to ONNX format.

        Args:
            path (str): The path to save the .onnx file.
            batch_size (int): The batch size for the dummy input.
        """
        self.eval()  # Set the model to evaluation mode
        dummy_input = torch.randn(batch_size, self.input_size, requires_grad=True)
        
        torch.onnx.export(
            self,
            dummy_input,
            path,
            export_params=True,
            opset_version=14, # A reasonably modern opset
            do_constant_folding=True,
            input_names=['params'],
            output_names=['s11_raw'],
            dynamic_axes={
                'params': {0: 'batch_size'},
                's11_raw': {0: 'batch_size'}
            }
        )
