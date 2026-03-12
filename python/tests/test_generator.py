import json
import os
from pathlib import Path
import pytest

from data.generator import generate_mock_data

@pytest.fixture
def mock_data_file(tmp_path: Path) -> str:
    """Fixture to generate a mock data file and return its path."""
    output_path = str(tmp_path / "mock_dataset.jsonl")
    num_samples = 10
    param_config = {
        "length": {"min": 0.05, "max": 0.15},
        "width": {"min": 0.005, "max": 0.015}
    }
    num_freq_points = 51
    
    generate_mock_data(
        output_path=output_path,
        num_samples=num_samples,
        param_config=param_config,
        num_freq_points=num_freq_points
    )
    return output_path

def test_generate_mock_data_file_creation(mock_data_file: str):
    """Test if the data file is created."""
    assert os.path.exists(mock_data_file)

def test_generate_mock_data_content(mock_data_file: str):
    """Test the content of the generated mock data file."""
    num_samples = 10
    num_params = 2
    num_freq_points = 51
    
    lines = []
    with open(mock_data_file, 'r') as f:
        lines = f.readlines()
    
    assert len(lines) == num_samples

    for line in lines:
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            pytest.fail("Line is not valid JSON.")

        assert "params" in data
        assert "s11" in data
        assert "far_field" in data

        assert isinstance(data["params"], dict)
        assert len(data["params"]) == num_params
        
        assert isinstance(data["s11"], list)
        assert len(data["s11"]) == num_freq_points * 2
        
        assert isinstance(data["far_field"], list)
        assert len(data["far_field"]) == 0

def test_generate_mock_data_empty(tmp_path: Path):
    """Test generating a file with zero samples."""
    output_path = tmp_path / "empty.jsonl"
    generate_mock_data(
        output_path=str(output_path),
        num_samples=0,
        param_config={"length": {"min": 0.1, "max": 0.2}},
        num_freq_points=10
    )
    with open(output_path, 'r') as f:
        content = f.read()
    assert content == ""
