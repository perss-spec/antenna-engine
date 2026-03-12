from typing import Tuple

import numpy as np
import pytest

from antenna_ml.optimizer import AntennaOptimizer, SurrogateModel


class MockDipoleSurrogate(SurrogateModel):
    """
    A mock surrogate model for a simple dipole antenna.
    The resonant frequency is modeled as f_res (GHz) = 150 / length (mm).
    This is a simplified physical relationship for a half-wave dipole.
    """

    def __init__(
        self,
        freq_start_ghz: float = 1.0,
        freq_stop_ghz: float = 5.0,
        num_points: int = 401,
    ):
        self.frequencies = np.linspace(freq_start_ghz, freq_stop_ghz, num_points)

    def predict(self, params: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predicts the S11 curve for a given dipole length.

        Args:
            params (np.ndarray): A 1-element array containing the dipole length in mm.

        Returns:
            Tuple[np.ndarray, np.ndarray]: Frequencies (GHz) and complex S11 values.
        """
        if params.ndim != 1 or len(params) != 1:
            raise ValueError("Expected a 1D array with a single parameter (length).")

        length_mm = params[0]

        # Simplified model: resonant frequency f_res = 150 / length
        f_res_ghz = 150.0 / length_mm

        # Model S11 magnitude as a V-shape centered at f_res.
        # tanh creates a value between 0 and 1.
        s11_mag = np.tanh(0.5 * np.abs(self.frequencies - f_res_ghz))

        # The phase is not important for this test's objective function,
        # but we return a complex array to match the interface.
        s11_complex = s11_mag * np.exp(1j * np.pi / 4)

        return self.frequencies, s11_complex


def test_optimizer_initialization():
    """Tests that the optimizer initializes correctly."""
    model = MockDipoleSurrogate()
    optimizer = AntennaOptimizer(model)
    assert optimizer.model is model

    class BadModel:
        pass

    with pytest.raises(TypeError, match="Model must have a callable 'predict' method."):
        AntennaOptimizer(BadModel())


def test_find_optimal_dipole_length():
    """
    Tests the optimizer's ability to find the correct dipole length for a
    target frequency using the mock surrogate model.
    """
    # 1. Setup
    mock_model = MockDipoleSurrogate()
    optimizer = AntennaOptimizer(mock_model)

    target_freq_ghz = 2.4

    # Theoretical optimal length from our mock model's formula
    expected_optimal_length = 150.0 / target_freq_ghz  # approx 62.5 mm

    # 2. Define search space and initial guess
    length_bounds_mm = (50.0, 70.0)
    initial_length_mm = 60.0

    # 3. Run optimization
    optimal_length, min_s11_mag = optimizer.find_optimal_length(
        target_frequency_ghz=target_freq_ghz,
        initial_length_mm=initial_length_mm,
        length_bounds_mm=length_bounds_mm,
    )

    # 4. Assert results
    assert isinstance(optimal_length, float)
    assert np.isclose(optimal_length, expected_optimal_length, atol=1e-4)

    assert isinstance(min_s11_mag, float)
    assert min_s11_mag < 1e-6


def test_optimize_general_method():
    """
    Tests the more general `optimize` method.
    """
    mock_model = MockDipoleSurrogate()
    optimizer = AntennaOptimizer(mock_model)

    target_freq_ghz = 3.5
    expected_optimal_length = 150.0 / target_freq_ghz  # approx 42.857 mm

    initial_guess = np.array([40.0])
    bounds = [(30.0, 50.0)]

    optimal_params, min_value = optimizer.optimize(
        target_frequency_ghz=target_freq_ghz, initial_guess=initial_guess, bounds=bounds
    )

    assert optimal_params.shape == (1,)
    assert np.isclose(optimal_params[0], expected_optimal_length, atol=1e-4)
    assert min_value < 1e-6


def test_optimizer_input_validation():
    """Tests that the optimizer raises errors for invalid inputs."""
    mock_model = MockDipoleSurrogate()
    optimizer = AntennaOptimizer(mock_model)

    with pytest.raises(
        ValueError, match="Length of initial_guess must match length of bounds."
    ):
        optimizer.optimize(
            target_frequency_ghz=2.4,
            initial_guess=np.array([60.0, 1.0]),  # two params
            bounds=[(50.0, 70.0)],  # one bound
        )
