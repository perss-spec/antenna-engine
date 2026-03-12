import json
import pytest
from pathlib import Path

from data.generator import generate_s11_dataset
from antenna_ml.data.simulation_data import SimulationResult


@pytest.fixture
def generator_config(tmp_path: Path) -> dict:
    """Provides a standard configuration for the data generator for tests."""
    return {
        "num_simulations": 10,
        "output_path": tmp_path / "test_dataset.jsonl",
        "param_ranges": {"length": (0.05, 0.15), "radius": (0.001, 0.005)},
        "freq_range": (1e9, 2e9),
        "num_freq_points": 51,
    }


def test_generator_creates_file(generator_config: dict):
    """Tests if the generator script successfully creates an output file."""
    generate_s11_dataset(**generator_config)
    assert generator_config["output_path"].exists()
    assert generator_config["output_path"].is_file()


def test_generator_file_content(generator_config: dict):
    """Tests the content of the generated file for correctness."""
    generate_s11_dataset(**generator_config)

    lines = generator_config["output_path"].read_text().strip().split('\n')
    assert len(lines) == generator_config["num_simulations"]

    # Validate each line against the Pydantic model
    for line in lines:
        data = json.loads(line)
        # This will raise a ValidationError if the data is malformed
        sim_result = SimulationResult(**data)

        assert isinstance(sim_result, SimulationResult)
        assert len(sim_result.params) == len(generator_config["param_ranges"])
        assert len(sim_result.s11) == generator_config["num_freq_points"]
        assert "length" in sim_result.params
        assert "radius" in sim_result.params


def test_generator_empty_file_for_zero_simulations(generator_config: dict):
    """Tests that an empty file is created for zero simulations."""
    generator_config["num_simulations"] = 0
    generate_s11_dataset(**generator_config)

    content = generator_config["output_path"].read_text()
    assert content == ""
