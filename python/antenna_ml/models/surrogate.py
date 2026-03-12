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
        self.input_size = input_size
        self.model = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_size)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)

    def export_onnx(self, path: str) -> None:
        """Export model to ONNX format for Rust inference via ort crate."""
        import torch
        dummy_input = torch.randn(1, self.input_size)
        torch.onnx.export(
            self.model, dummy_input, path,
            input_names=['parameters'],
            output_names=['prediction'],
            dynamic_axes={'parameters': {0: 'batch'}, 'prediction': {0: 'batch'}},
            opset_version=17
        )


def predict_gain(params: AntennaParameters, model_path: str) -> GainPrediction:
    """
    Loads a trained surrogate model and predicts antenna gain for the given parameters.
    This function is designed to be called from Rust via PyO3.

    Raises:
        FileNotFoundError: If the model file does not exist.
    """
    model_file = Path(model_path)
    if not model_file.exists():
        raise FileNotFoundError(f"Model file not found at: {model_path}")

    model = SurrogateAntennaModel(input_size=3, output_size=1)
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    model.eval()

    input_data = torch.tensor(
        [[params.length, params.width, params.substrate_height]],
        dtype=torch.float32
    )

    with torch.no_grad():
        prediction = model(input_data)

    return GainPrediction(gain_db=prediction.item())
