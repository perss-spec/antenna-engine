import pytest
import torch
import numpy as np

from antenna_ml.optimizer import AntennaOptimizer
from antenna_ml.data_models import OptimizationResult
from models.base import BaseSurrogateModel

# The optimal length we want the optimizer to find in our test
TARGET_OPTIMAL_LENGTH = 0.062

# The target frequency for optimization
TARGET_FREQ_GHZ = 2.45

class MockDipoleSurrogate(BaseSurrogateModel):
    """
    A mock surrogate model for a dipole antenna for testing the optimizer.
    The model's performance (S11) is a simple quadratic function of the length,
    with a known minimum at TARGET_OPTIMAL_LENGTH.
    """
    def __init__(self):
        param_mean = torch.tensor([0.06])
        param_std = torch.tensor([0.01])
        freq_ghz = torch.linspace(2.0, 3.0, 101)
        
        super().__init__(
            param_names=['length'],
            param_mean=param_mean,
            param_std=param_std,
            freq_ghz=freq_ghz
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Mock forward pass.
        x is a normalized tensor of shape (batch_size, 1).
        """
        length = x * self.param_std + self.param_mean
        
        k = 5e5
        s11_min_db = -30.0
        base_s11 = s11_min_db + k * (length - TARGET_OPTIMAL_LENGTH)**2
        
        resonant_freq = TARGET_FREQ_GHZ * TARGET_OPTIMAL_LENGTH / length
        
        freq_ghz_grid = self.freq_ghz.unsqueeze(0)
        
        s11_curve = base_s11 + 1e3 * (freq_ghz_grid - resonant_freq)**2
        
        s11_curve = torch.clamp(s11_curve, max=0.0)
        
        return s11_curve

    def export_onnx(self, path: str):
        pass

@pytest.fixture
def mock_dipole_model() -> MockDipoleSurrogate:
    """Pytest fixture to provide a mock model instance."""
    return MockDipoleSurrogate()

def test_optimizer_initialization(mock_dipole_model):
    """Test that the optimizer initializes correctly."""
    optimizer = AntennaOptimizer(model=mock_dipole_model, target_freq_ghz=TARGET_FREQ_GHZ)
    assert optimizer.model is mock_dipole_model
    assert optimizer.target_freq_ghz == TARGET_FREQ_GHZ

def test_optimizer_raises_with_wrong_model_type():
    """Test that a TypeError is raised if the model is not a BaseSurrogateModel."""
    with pytest.raises(TypeError):
        AntennaOptimizer(model=object(), target_freq_ghz=2.4)

def test_optimize_dipole_length_finds_minimum(mock_dipole_model):
    """
    Test the core functionality: can the optimizer find the known optimal length?
    """
    optimizer = AntennaOptimizer(model=mock_dipole_model, target_freq_ghz=TARGET_FREQ_GHZ)
    
    bounds = (0.05, 0.07)
    
    result = optimizer.optimize_dipole_length(bounds=bounds)
    
    assert isinstance(result, OptimizationResult)
    
    optimal_length = result.optimal_params['length']
    assert optimal_length == pytest.approx(TARGET_OPTIMAL_LENGTH, abs=1e-5)
    
    assert result.objective_value == pytest.approx(-30.0, abs=1e-3)

def test_objective_function_evaluation(mock_dipole_model):
    """Test the objective function directly to ensure it returns expected values."""
    optimizer = AntennaOptimizer(model=mock_dipole_model, target_freq_ghz=TARGET_FREQ_GHZ)
    
    val_at_optimum = optimizer._objective_func_single_param(TARGET_OPTIMAL_LENGTH, 'length')
    assert val_at_optimum == pytest.approx(-30.0, abs=1e-3)
    
    val_off_optimum = optimizer._objective_func_single_param(TARGET_OPTIMAL_LENGTH + 0.005, 'length')
    assert val_off_optimum > -30.0
