import numpy as np
import pytest
from antenna_ml.data.normalization import MinMaxNormalizer


@pytest.fixture
def sample_params_list():
    return [
        {"length": 10, "width": 1},
        {"length": 20, "width": 3},
        {"length": 15, "width": 5},
    ]


def test_normalizer_fit(sample_params_list):
    normalizer = MinMaxNormalizer()
    normalizer.fit(sample_params_list)

    assert normalizer.param_keys == ["length", "width"]
    assert normalizer.min_vals == {"length": 10, "width": 1}
    assert normalizer.max_vals == {"length": 20, "width": 5}


def test_normalizer_transform(sample_params_list):
    normalizer = MinMaxNormalizer()
    normalizer.fit(sample_params_list)

    # Test min values (order is 'length', 'width')
    transformed_min = normalizer.transform({"length": 10, "width": 1})
    np.testing.assert_allclose(transformed_min, [0.0, 0.0])

    # Test max values
    transformed_max = normalizer.transform({"length": 20, "width": 5})
    np.testing.assert_allclose(transformed_max, [1.0, 1.0])

    # Test mid values
    transformed_mid = normalizer.transform({"length": 15, "width": 3})
    np.testing.assert_allclose(transformed_mid, [0.5, 0.5])


def test_normalizer_inverse_transform(sample_params_list):
    normalizer = MinMaxNormalizer()
    normalizer.fit(sample_params_list)

    original_params = {"length": 15, "width": 3}
    normalized = normalizer.transform(original_params)
    reconstructed = normalizer.inverse_transform(normalized)

    assert list(reconstructed.keys()) == normalizer.param_keys
    assert np.isclose(reconstructed["length"], original_params["length"])
    assert np.isclose(reconstructed["width"], original_params["width"])


def test_normalizer_edge_case_single_value():
    params_list = [{"length": 10, "width": 5}]
    normalizer = MinMaxNormalizer()
    normalizer.fit(params_list)

    assert normalizer.min_vals == {"length": 10, "width": 5}
    assert normalizer.max_vals == {"length": 10, "width": 5}

    # Should not divide by zero
    transformed = normalizer.transform({"length": 10, "width": 5})
    np.testing.assert_allclose(transformed, [0.0, 0.0])
