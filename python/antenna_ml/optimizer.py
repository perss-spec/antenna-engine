import numpy as np
from scipy.optimize import minimize_scalar
from scipy.interpolate import interp1d
from typing import Dict, Tuple

from antenna_ml.data_models import OptimizationResult
from models.base import BaseSurrogateModel

class AntennaOptimizer:
    """
    Optimizes antenna parameters using a surrogate model to achieve a target performance.
    """

    def __init__(self, model: BaseSurrogateModel, target_freq_ghz: float):
        """
        Initializes the optimizer.

        Args:
            model: A trained surrogate model instance that conforms to BaseSurrogateModel.
            target_freq_ghz: The target frequency in GHz for optimization.
        """
        if not isinstance(model, BaseSurrogateModel):
            raise TypeError("model must be an instance of BaseSurrogateModel")
        
        self.model = model
        self.target_freq_ghz = target_freq_ghz

    def _objective_func_single_param(self, param_value: float, param_name: str) -> float:
        """
        Objective function for a single parameter optimization.
        It predicts the S11 curve and returns the S11 value at the target frequency.
        """
        # Create the parameter dictionary for the model
        params = {param_name: param_value}
        
        # Predict S11 using the surrogate model
        freqs_ghz, s11_db = self.model.predict(params)
        
        freqs_ghz_np = freqs_ghz.cpu().numpy()
        s11_db_np = s11_db.cpu().numpy()

        if not (freqs_ghz_np.min() <= self.target_freq_ghz <= freqs_ghz_np.max()):
            return 100.0

        interp_func = interp1d(
            freqs_ghz_np, 
            s11_db_np, 
            kind='linear', 
            bounds_error=False, 
            fill_value=0.0
        )
        
        s11_at_target = interp_func(self.target_freq_ghz)
        
        return float(s11_at_target)

    def optimize_dipole_length(
        self, 
        bounds: Tuple[float, float], 
        method: str = 'bounded', 
        **kwargs
    ) -> OptimizationResult:
        """
        Optimizes the 'length' parameter of a dipole antenna.

        Args:
            bounds: A tuple (min_length, max_length) for the search.
            method: The optimization method for `scipy.optimize.minimize_scalar`.
            **kwargs: Additional arguments passed to `minimize_scalar`.

        Returns:
            An OptimizationResult object with the optimal length and S11 value.
        """
        if 'length' not in self.model.param_names:
            raise ValueError("The provided model is not a dipole model ('length' parameter is missing).")
        if len(self.model.param_names) > 1:
            print(f"Warning: Model has multiple parameters: {self.model.param_names}. "
                  f"This method only optimizes 'length'. Others are not being set.")

        objective = lambda length: self._objective_func_single_param(length, 'length')

        result = minimize_scalar(
            objective,
            bounds=bounds,
            method=method,
            options=kwargs
        )

        if not result.success:
            print(f"Warning: Optimization may not have succeeded. Message: {result.message}")

        return OptimizationResult(
            optimal_params={'length': result.x},
            objective_value=result.fun
        )
