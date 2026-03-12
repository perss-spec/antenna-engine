from typing import Callable, List, Tuple, Dict

import numpy as np
from scipy.optimize import minimize, OptimizeResult


class AntennaOptimizer:
    """Optimizes antenna parameters using a surrogate model.

    This class uses scipy.optimize.minimize to find the set of parameters
    that minimizes the S11 magnitude at a given target frequency.
    """

    def __init__(
        self,
        surrogate_model: Callable[[np.ndarray], np.ndarray],
        param_names: List[str],
        freq_mhz: np.ndarray,
        target_freq_mhz: float,
        bounds: List[Tuple[float, float]],
    ):
        """Initializes the AntennaOptimizer.

        Args:
            surrogate_model: A callable (the surrogate model) that takes a numpy
                array of parameter values and returns a numpy array of S11 dB values.
            param_names: A list of parameter names corresponding to the input
                of the surrogate model.
            freq_mhz: A numpy array of frequency points (in MHz) for the S11 curve.
            target_freq_mhz: The target frequency (in MHz) for optimization.
            bounds: A list of (min, max) tuples for each parameter.
        """
        if len(param_names) != len(bounds):
            raise ValueError("Length of param_names must match length of bounds.")

        self.surrogate_model = surrogate_model
        self.param_names = param_names
        self.freq_mhz = freq_mhz
        self.target_freq_mhz = target_freq_mhz
        self.bounds = bounds

        # Find the index of the frequency closest to the target frequency
        self.target_freq_idx = np.argmin(np.abs(self.freq_mhz - self.target_freq_mhz))
        actual_freq = self.freq_mhz[self.target_freq_idx]
        if not np.isclose(actual_freq, self.target_freq_mhz, atol=1e-1):
            print(
                f"Warning: Target frequency {self.target_freq_mhz} MHz not in frequency list. "
                f"Using closest frequency: {actual_freq} MHz."
            )

    def _objective_function(self, params: np.ndarray) -> float:
        """Objective function to be minimized (S11 magnitude at target frequency)."""
        # Scipy optimizer might pass a 1D array, ensure it's 2D for model input
        params_reshaped = params.reshape(1, -1)
        s11_db = self.surrogate_model(params_reshaped)
        s11_at_target_freq = s11_db[0, self.target_freq_idx]
        return float(s11_at_target_freq)

    def optimize(
        self, x0: np.ndarray, method: str = "L-BFGS-B"
    ) -> Tuple[Dict[str, float], float, OptimizeResult]:
        """Runs the optimization process.

        Args:
            x0: Initial guess for the parameters.
            method: Optimization method to use, compatible with bounds (e.g., 'L-BFGS-B').

        Returns:
            A tuple containing:
            - A dictionary of the best parameters found.
            - The minimum S11 value (dB) achieved at the target frequency.
            - The full optimization result object from scipy.
        """
        result = minimize(
            self._objective_function, x0, method=method, bounds=self.bounds
        )

        best_params_dict = {name: val for name, val in zip(self.param_names, result.x)}
        min_s11_val = result.fun

        return best_params_dict, min_s11_val, result
