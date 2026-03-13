import json
import pytest
from pathlib import Path

from antenna_ml.data.yagi_generator import generate_yagi_dataset
from antenna_ml.data.simulation_data import SimulationResult

@pytest.fixture
def yagi_generator_config(tmp_path: Path) -> dict:
    """Provides a standard configuration for the Yagi data generator for tests."""
    return {
        "num_simulations": 10,
        "output_path": tmp_path / "yagi_test_dataset.jsonl",
        "freq_range": (0.5e9, 1.0e9),
        "num_freq_points": 51,
    }

def test_yagi_generator_creates_files(yagi_generator_config: dict):
    """Tests if the generator creates both the dataset and metadata files."""
    generate_yagi_dataset(**yagi_generator_config)
    
    output_path = yagi_generator_config["output_path"]
    meta_path = output_path.with_suffix(".meta.json")

    assert output_path.exists()
    assert output_path.is_file()
    assert meta_path.exists()
    assert meta_path.is_file()

def test_yagi_generator_dataset_content(yagi_generator_config: dict):
    """Tests the content of the generated JSONL file for correctness."""
    generate_yagi_dataset(**yagi_generator_config)

    output_path = yagi_generator_config["output_path"]
    lines = output_path.read_text().strip().split('\n')
    assert len(lines) == yagi_generator_config["num_simulations"]

    # Validate the first line against the SimulationResult Pydantic model
    data = json.loads(lines[0])
    sim_result = SimulationResult(**data)

    assert isinstance(sim_result, SimulationResult)
    # Check for Yagi-specific parameters
    assert "driven_length" in sim_result.params
    assert "reflector_spacing" in sim_result.params
    assert "director1_length" in sim_result.params
    assert len(sim_result.params) == 8 # 8 parameters in YagiParameters
    assert len(sim_result.s11) == yagi_generator_config["num_freq_points"]

def test_yagi_generator_metadata_content(yagi_generator_config: dict):
    """Tests the content of the generated metadata file."""
    generate_yagi_dataset(**yagi_generator_config)

    output_path = yagi_generator_config["output_path"]
    meta_path = output_path.with_suffix(".meta.json")
    
    with open(meta_path, "r") as f:
        metadata = json.load(f)

    assert metadata["dataset_name"] == "yagi_test_dataset"
    assert "generation_timestamp_utc" in metadata
    assert metadata["schema_version"] == "1.0"
    assert metadata["antenna_type"] == "Yagi-Uda (1R-1DE-2D)"
    
    gen_config = metadata["generator_config"]
    assert gen_config["num_simulations"] == yagi_generator_config["num_simulations"]
    assert "param_sampling_config" in gen_config
