"""
Generates synthetic training data for the antenna surrogate model.
"""
import numpy as np


def simulate_gain(length: float, width: float, substrate_height: float) -> float:
    """
    A simplified, non-physical formula to simulate antenna gain.
    Peak performance is around length=15, width=1.5, height=0.8.
    """
    len_factor = np.exp(-((length - 15) ** 2) / 50)
    width_factor = np.exp(-((width - 1.5) ** 2) / 2)
    height_factor = 1 / (1 + (substrate_height - 0.8) ** 2)
    base_gain = 12.0
    gain = base_gain * len_factor * width_factor * height_factor
    noise = np.random.normal(0, 0.2)
    return gain + noise


def generate_synthetic_data(
    num_samples: int, seed: int | None = None
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generates a dataset of antenna parameters and their corresponding gains.

    Returns:
        X: shape (num_samples, 3) — [length, width, substrate_height]
        y: shape (num_samples, 1) — gain_db
    """
    if seed is not None:
        np.random.seed(seed)

    param_ranges = {
        "length": (5.0, 25.0),
        "width": (0.5, 2.5),
        "substrate_height": (0.5, 2.0),
    }

    X = np.random.rand(num_samples, 3)
    X[:, 0] = X[:, 0] * (param_ranges["length"][1] - param_ranges["length"][0]) + param_ranges["length"][0]
    X[:, 1] = X[:, 1] * (param_ranges["width"][1] - param_ranges["width"][0]) + param_ranges["width"][0]
    X[:, 2] = X[:, 2] * (param_ranges["substrate_height"][1] - param_ranges["substrate_height"][0]) + param_ranges["substrate_height"][0]

    y = np.array([
        simulate_gain(length, width, height)
        for length, width, height in X
    ]).reshape(-1, 1)

    return X.astype(np.float32), y.astype(np.float32)
