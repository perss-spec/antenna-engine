import torch
import torch.nn as nn

class SurrogateMLP(nn.Module):
    """
    A simple Multi-Layer Perceptron (MLP) to act as a surrogate model.
    It predicts simulation results (e.g., S-parameters) from antenna parameters.
    """
    def __init__(self, input_dim: int, output_dim: int, hidden_dim: int = 128):
        """
        Initializes the surrogate model.

        Args:
            input_dim (int): The number of input antenna parameters.
            output_dim (int): The number of output simulation values (e.g., S11 points).
            hidden_dim (int): The size of the hidden layers.
        """
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim * 2),
            nn.ReLU(),
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs a forward pass through the network.

        Args:
            x (torch.Tensor): A batch of input antenna parameters.
                              Shape: (batch_size, input_dim)

        Returns:
            torch.Tensor: The predicted simulation results.
                          Shape: (batch_size, output_dim)
        """
        return self.network(x)

def get_model_example(input_dim: int = 4, output_dim: int = 101) -> SurrogateMLP:
    """
    Factory function to get an example instance of the surrogate model.
    """
    model = SurrogateMLP(input_dim=input_dim, output_dim=output_dim)
    return model
