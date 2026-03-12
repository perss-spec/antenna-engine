import torch
import torch.nn as nn
from typing import List


class S11SurrogateModel(nn.Module):
    """
    A PyTorch MLP surrogate model for predicting S11 parameters.

    This model adheres to the task T5-AIML-1 specification for architecture,
    including specific hidden layer sizes and the use of BatchNorm. It predicts
    the S11 curve from a set of normalized antenna parameters.

    Input: Normalized antenna parameters (e.g., length, radius).
    Output: Flattened S11 curve (real and imaginary parts interleaved).
    Architecture: 3 hidden layers (64, 128, 64) with ReLU and BatchNorm.
    """

    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        hidden_dims: List[int] = [64, 128, 64],
    ):
        """
        Initializes the S11SurrogateModel.

        Args:
            input_dim: The number of input antenna parameters.
            output_dim: The size of the output vector (2 * num_frequency_points).
            hidden_dims: A list of integers specifying the size of each hidden layer.
        """
        super().__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim

        layers: List[nn.Module] = []
        current_dim = input_dim

        for h_dim in hidden_dims:
            layers.append(nn.Linear(current_dim, h_dim))
            # BatchNorm is applied on the features dimension
            layers.append(nn.BatchNorm1d(h_dim))
            layers.append(nn.ReLU())
            current_dim = h_dim

        # Final output layer
        layers.append(nn.Linear(current_dim, output_dim))

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
        dummy_input = torch.randn(1, self.input_dim, device=next(self.parameters()).device)

        # Set the model to evaluation mode. This is crucial for layers like
        # BatchNorm and Dropout to behave correctly during inference.
        self.eval()

        print(f"Exporting model to ONNX at {path}...")
        torch.onnx.export(
            self,
            dummy_input,
            path,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=['antenna_params'],
            output_names=['s11_real_imag'],
            dynamic_axes={
                'antenna_params': {0: 'batch_size'},
                's11_real_imag': {0: 'batch_size'},
            },
        )
