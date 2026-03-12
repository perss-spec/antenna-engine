import numpy as np
from typing import Dict, List


class MinMaxNormalizer:
    """
    Normalizes a dictionary of parameters to the [0, 1] range using min-max scaling.
    The order of parameters is fixed after fitting.
    """

    def __init__(self):
        self.min_vals: Dict[str, float] = {}
        self.max_vals: Dict[str, float] = {}
        self.param_keys: List[str] = []

    def fit(self, params_list: List[Dict[str, float]]):
        """Calculates the min and max values for each parameter from a list of parameter dicts."""
        if not params_list:
            return

        # Fix the order of parameters
        self.param_keys = sorted(params_list[0].keys())

        # Initialize min/max with values from the first item
        first_params = params_list[0]
        self.min_vals = {key: first_params[key] for key in self.param_keys}
        self.max_vals = {key: first_params[key] for key in self.param_keys}

        # Iterate over the rest of the data to find true min/max
        for params in params_list[1:]:
            for key in self.param_keys:
                self.min_vals[key] = min(self.min_vals[key], params[key])
                self.max_vals[key] = max(self.max_vals[key], params[key])

    def transform(self, params: Dict[str, float]) -> np.ndarray:
        """Transforms a dictionary of parameters into a normalized numpy array."""
        normalized_params = np.zeros(len(self.param_keys), dtype=np.float32)
        for i, key in enumerate(self.param_keys):
            val = params[key]
            min_val = self.min_vals[key]
            max_val = self.max_vals[key]
            denominator = max_val - min_val
            if denominator > 1e-9:  # Avoid division by zero
                normalized_params[i] = (val - min_val) / denominator
            else:
                normalized_params[i] = 0.0  # Value is constant
        return normalized_params

    def inverse_transform(self, normalized_params: np.ndarray) -> Dict[str, float]:
        """Transforms a normalized numpy array back into a dictionary of parameters."""
        params = {}
        for i, key in enumerate(self.param_keys):
            norm_val = normalized_params[i]
            min_val = self.min_vals[key]
            max_val = self.max_vals[key]
            val = norm_val * (max_val - min_val) + min_val
            params[key] = val
        return params
