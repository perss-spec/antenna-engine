import warnings
from typing import List, Protocol, Tuple

import numpy as np
from scipy.optimize import minimize


class SurrogateModel(Protocol):
    """
    Protocol defining the interface for a surrogate model used by the optimizer.

    A class that implements this protocol must have a `predict` method that takes
    a numpy array of real-world parameters and returns the predicted performance.
    """

    def predict(self, params: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predicts antenna performance for given parameters.

        Args:
            params (np.ndarray): A 1D numpy array of antenna parameters
                                 in their real-world units (e.g., mm).

        Returns:
            Tuple[np.ndarray, np.ndarray]: A tuple containing:
                - frequencies (np.ndarray): 1D array of frequency points (in GHz).
                - s11_complex (np.ndarray): 1D array of complex S11 values.
        """
        ...


class AntennaOptimizer:
    """
    Optimizes antenna parameters to achieve a target performance goal
    using a surrogate model.
    """

    def __init__(self, model: SurrogateModel):
        """
        Initializes the optimizer with a surrogate model.

        Args:
            model (SurrogateModel): An object that conforms to the SurrogateModel
                                    protocol, used to evaluate antenna performance.
        """
        if not hasattr(model, "predict") or not callable(model.predict):
            raise TypeError("Model must have a callable 'predict' method.")
        self.model = model

    def find_optimal_length(
        self,
        target_frequency_ghz: float,
        initial_length_mm: float,
        length_bounds_mm: Tuple[float, float],
    ) -> Tuple[float, float]:
        """
        Finds the optimal length for a single-parameter antenna (like a dipole)
        to resonate at a target frequency.

        This is a convenience wrapper around the more general `optimize` method.

        Args:
            target_frequency_ghz (float): The desired resonant frequency in GHz.
            initial_length_mm (float): An initial guess for the antenna length in mm.
            length_bounds_mm (Tuple[float, float]): A tuple (min, max) defining the
                                                    search space for the length in mm.

        Returns:
            Tuple[float, float]: A tuple containing:
                - optimal_length (float): The optimized antenna length in mm.
                - min_s11_mag (float): The S11 magnitude at the target frequency
                                       for the optimal length.
        """
        initial_guess = np.array([initial_length_mm])
        bounds = [length_bounds_mm]

        optimal_params, min_value = self.optimize(
            target_frequency_ghz, initial_guess, bounds
        )
        return optimal_params[0], min_value

    def optimize(
        self,
        target_frequency_ghz: float,
        initial_guess: np.ndarray,
        bounds: List[Tuple[float, float]],
        method: str = "L-BFGS-B",
    ) -> Tuple[np.ndarray, float]:
        """
        Performs optimization to find antenna parameters that minimize S11 magnitude
        at a specific target frequency.

        Args:
            target_frequency_ghz (float): The target frequency in GHz for optimization.
            initial_guess (np.ndarray): A 1D array of initial guesses for the
                                        antenna parameters.
            bounds (List[Tuple[float, float]]): A list of (min, max) tuples for each
                                                parameter, defining the search space.
            method (str): The optimization algorithm to use with scipy.optimize.minimize.
                          Defaults to 'L-BFGS-B', which handles bounds.

        Returns:
            Tuple[np.ndarray, float]: A tuple containing:
                - optimal_params (np.ndarray): The set of optimized parameters.
                - min_value (float): The minimum objective function value (S11 magnitude)
                                     achieved.
        """
        if len(initial_guess) != len(bounds):
            raise ValueError("Length of initial_guess must match length of bounds.")

        def objective_function(params: np.ndarray) -> float:
            """
            Objective function to be minimized. It calculates the S11 magnitude
            at the target frequency for a given set of parameters.
            """
            frequencies, s11_complex = self.model.predict(params)

            # Find the index of the frequency closest to the target
            freq_idx = np.argmin(np.abs(frequencies - target_frequency_ghz))

            s11_at_target = s11_complex[freq_idx]

            # The cost is the magnitude of S11. Lower is better.
            cost = np.abs(s11_at_target)

            return float(cost)

        result = minimize(
            objective_function,
            x0=initial_guess,
            bounds=bounds,
            method=method,
        )

        if not result.success:
            warnings.warn(f"Optimization failed: {result.message}", RuntimeWarning)

        return result.x, float(result.fun)
