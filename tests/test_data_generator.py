import numpy as np
import pytest

from training.data_generator import generate_synthetic_data, simulate_gain

def test_generate_synthetic_data_shape_and_type():
    """Tests the output shape and dtype of the generated data."""
    num_samples = 100
    X, y = generate_synthetic_data(num_samples=num_samples, seed=42)

    assert isinstance(X, np.ndarray)
    assert isinstance(y, np.ndarray)
    
    assert X.shape == (num_samples, 3)
    assert y.shape == (num_samples, 1)

    assert X.dtype == np.float32
    assert y.dtype == np.float32

def test_generate_synthetic_data_reproducibility():
    """Tests that using the same seed produces the same data."""
    X1, y1 = generate_synthetic_data(num_samples=10, seed=123)
    X2, y2 = generate_synthetic_data(num_samples=10, seed=123)

    np.testing.assert_array_equal(X1, X2)
    np.testing.assert_array_equal(y1, y2)

def test_simulate_gain_returns_float():
    """Tests that the simulation function returns a single float."""
    gain = simulate_gain(length=15.0, width=1.5, substrate_height=0.8)
    assert isinstance(gain, float)

def test_generated_data_in_range():
    """Tests that the generated parameters are within the specified ranges."""
    X, _ = generate_synthetic_data(num_samples=1000, seed=42)
    
    # Ranges from the generator function
    param_ranges = {
        "length": (5.0, 25.0),
        "width": (0.5, 2.5),
        "substrate_height": (0.5, 2.0),
    }

    assert np.all(X[:, 0] >= param_ranges["length"][0])
    assert np.all(X[:, 0] <= param_ranges["length"][1])
    
    assert np.all(X[:, 1] >= param_ranges["width"][0])
    assert np.all(X[:, 1] <= param_ranges["width"][1])

    assert np.all(X[:, 2] >= param_ranges["substrate_height"][0])
    assert np.all(X[:, 2] <= param_ranges["substrate_height"][1])
