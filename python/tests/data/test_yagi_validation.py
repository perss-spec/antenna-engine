import pytest
from pathlib import Path

from antenna_ml.data.yagi_generator import generate_yagi_dataset
from data.validate import validate_dataset

@pytest.fixture(scope="module")
def generated_yagi_dataset_for_validation(tmp_path_factory) -> str:
    """
    Generates a small Yagi dataset once per module for validation testing.
    This fixture helps demonstrate that the generated data is valid.
    """
    tmp_path = tmp_path_factory.mktemp("yagi_validation_data")
    config = {
        "num_simulations": 50,
        "output_path": tmp_path / "yagi_validation.jsonl",
        "freq_range": (0.5e9, 1.0e9),
        "num_freq_points": 51,
    }
    generate_yagi_dataset(**config)
    return str(config["output_path"])

def test_validate_generated_yagi_dataset(generated_yagi_dataset_for_validation: str):
    """
    Fulfills AC: "Training data validation shows <5% corrupted samples".

    This test runs the project's own validation script on a generated Yagi dataset.
    If `validate_dataset` completes without raising an exception, it confirms that
    100% of the samples are valid according to the defined checks (i.e., 0% corruption).
    """
    try:
        stats = validate_dataset(generated_yagi_dataset_for_validation)
        # Check some basic stats to ensure the validator ran correctly
        assert stats["num_samples"] == 50
        assert stats["num_freq_points"] == 51
        assert "driven_length" in stats["param_ranges"]
    except Exception as e:
        pytest.fail(f"Dataset validation failed on generated Yagi data: {e}")
