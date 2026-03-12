import numpy as np
import pytest

from antenna_ml.optimizer import AntennaOptimizer

# --- Mock Surrogate Model for a Dipole Antenna ---
# This mock simulates a simple dipole where the resonant frequency is inversely
# proportional to its length. We design it so that a known length gives the
# best S11 at our target frequency.

# Constants for the mock model
TARGET_FREQ_MHZ = 3000.0
OPTIMAL_LENGTH = 0.047  # meters, chosen as the 'true' optimal length for 3GHz
C_FACTOR = TARGET_FREQ_MHZ * OPTIMAL_LENGTH  # A constant to define resonance


def mock_surrogate_model(params: np.ndarray) -> np.ndarray:
    """A mock surrogate model for a single-parameter (length) dipole.

    Args:
        params: A numpy array of shape (batch_size, 1) where the column is length.

    Returns:
        A numpy array of shape (batch_size, num_freqs) representing S11 dB.
    """
    length = params[:, 0]
    freqs = np.linspace(2000, 4000, 101).reshape(1, -1)

    # Resonant frequency is inversely proportional to length
    resonant_freq = C_FACTOR / length.reshape(-1, 1)

    # Simple quadratic model for S11 notch: S11(f) = A*(f - f_res)^2 + S11_min
    # This gives a parabolic notch at the resonant frequency.
    s11_min = -30.0  # dB
    q_factor = 0.001 # Controls the width of the notch
    s11_db = q_factor * (freqs - resonant_freq) ** 2 + s11_min

    return s11_db


def test_optimizer_initialization():
    """Test the initialization of the AntennaOptimizer."""
    freqs = np.linspace(2000, 4000, 101)
    optimizer = AntennaOptimizer(
        surrogate_model=mock_surrogate_model,
        param_names=["length"],
        freq_mhz=freqs,
        target_freq_mhz=TARGET_FREQ_MHZ,
        bounds=[(0.03, 0.06)],
    )
    assert optimizer.target_freq_idx == np.argmin(np.abs(freqs - TARGET_FREQ_MHZ))
    assert optimizer.param_names == ["length"]


def test_optimizer_value_error():
    """Test that a ValueError is raised for mismatched params and bounds."""
    with pytest.raises(ValueError):
        AntennaOptimizer(
            surrogate_model=mock_surrogate_model,
            param_names=["length", "radius"], # 2 params
            freq_mhz=np.linspace(2000, 4000, 101),
            target_freq_mhz=TARGET_FREQ_MHZ,
            bounds=[(0.03, 0.06)], # 1 bound
        )

def test_dipole_length_optimization():
    """Test the full optimization process for a dipole's length."""
    freqs = np.linspace(2000, 4000, 101)
    param_names = ["length"]
    bounds = [(0.03, 0.06)]

    optimizer = AntennaOptimizer(
        surrogate_model=mock_surrogate_model,
        param_names=param_names,
        freq_mhz=freqs,
        target_freq_mhz=TARGET_FREQ_MHZ,
        bounds=bounds,
    )

    # Initial guess, intentionally off from the optimal value
    x0 = np.array([0.04])

    best_params, min_s11, result = optimizer.optimize(x0)

    assert result.success, f"Optimization failed: {result.message}"

    # Check that the optimizer found the known optimal length
    assert "length" in best_params
    found_length = best_params["length"]
    assert np.isclose(
        found_length, OPTIMAL_LENGTH, atol=1e-5
    ), f"Expected length {OPTIMAL_LENGTH}, but found {found_length}"

    # Check that the minimum S11 value is close to the model's minimum
    assert np.isclose(
        min_s11, -30.0, atol=1e-5
    ), f"Expected min S11 of -30.0 dB, but got {min_s11}"
