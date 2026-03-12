"""
Defines the PyTorch neural network model for antenna gain prediction
and provides an inference function for use with PyO3.
"""
import torch
import torch.nn as nn
from pathlib import Path

from antenna_ml.types import AntennaParameters, GainPrediction

class SurrogateAntennaModel(nn.Module):
    """
    A simple Multi-Layer Perceptron (MLP) to approximate antenna gain.
    """
    def __init__(self, input_size: int = 3, hidden_size: int = 64, output_size: int = 1):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_size)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Performs a forward pass through the network.

        Args:
            x: Input tensor of shape (batch_size, input_size).

        Returns:
            Output tensor of shape (batch_size, output_size).
        """
        return self.layers(x)

def predict_gain(params: AntennaParameters, model_path: str) -> GainPrediction:
    """
    Loads a trained surrogate model and predicts antenna gain for the given parameters.
    This function is designed to be called from Rust via PyO3.

    Args:
        params: An AntennaParameters object with the antenna geometry.
        model_path: Path to the saved PyTorch model state dictionary (.pth file).

    Returns:
        A GainPrediction object containing the predicted gain.
        
    Raises:
        FileNotFoundError: If the model file does not exist.
        Exception: For other errors during model loading or inference.
    """
    model_file = Path(model_path)
    if not model_file.exists():
        raise FileNotFoundError(f"Model file not found at: {model_path}")

    # Instantiate the model with the same architecture as during training
    model = SurrogateAntennaModel(input_size=3, output_size=1)
    
    # Load the trained weights
    # Use map_location to ensure it works on CPU-only machines
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    
    # Set the model to evaluation mode
    model.eval()

    # Prepare the input tensor
    input_data = torch.tensor(
        [[params.length, params.width, params.substrate_height]],
        dtype=torch.float32
    )

    # Perform inference without calculating gradients
    with torch.no_grad():
        prediction = model(input_data)

    predicted_gain = prediction.item()

    return GainPrediction(gain_db=predicted_gain)
