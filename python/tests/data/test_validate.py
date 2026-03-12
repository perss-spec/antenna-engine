import json
import math
import pytest
from pathlib import Path

from data.validate import validate_dataset

@pytest.fixture
def valid_dataset_file(tmp_path: Path) -> str:
    """Creates a temporary valid JSONL dataset file."""
    dataset_path = tmp_path / "valid_data.jsonl"
    lines = [
        {"params": {"length": 0.1, "radius": 0.001}, "s11": [{"real": 0.1, "imag": -0.1}, {"real": 0.01, "imag": -0.02}]},
        {"params": {"length": 0.2, "radius": 0.002}, "s11": [{"real": 0.3, "imag": 0.0}, {"real": 0.0, "imag": 0.0}]},
        {"params": {"length": 0.15, "radius": 0.0015}, "s11": [{"real": 0.8, "imag": 0.6}, {"real": 0.5, "imag": 0.0}]},
    ]
    with dataset_path.open("w") as f:
        for line in lines:
            f.write(json.dumps(line) + "\n")
    return str(dataset_path)

def test_validate_valid_dataset(valid_dataset_file: str):
    """Tests validation on a well-formed dataset."""
    stats = validate_dataset(valid_dataset_file)

    assert stats["num_samples"] == 3
    assert stats["num_freq_points"] == 2
    assert stats["param_ranges"] == {
        "length": {"min": 0.1, "max": 0.2},
        "radius": {"min": 0.001, "max": 0.002},
    }
    
    # Expected values:
    # line 1: max s11_db is approx -17
    # line 2: one value is -inf
    # line 3: max s11_db is 0
    # So, min is -inf, max is 0
    assert stats["s11_range_db"][0] == float('-inf')
    assert stats["s11_range_db"][1] == pytest.approx(0.0)

def test_validate_nonexistent_file():
    """Ensures FileNotFoundError is raised for a non-existent path."""
    with pytest.raises(FileNotFoundError):
        validate_dataset("nonexistent/file.jsonl")

def test_validate_empty_file(tmp_path: Path):
    """Ensures ValueError is raised for an empty file."""
    empty_file = tmp_path / "empty.jsonl"
    empty_file.touch()
    with pytest.raises(ValueError, match="Dataset is empty"):
        validate_dataset(str(empty_file))

def test_validate_invalid_json(tmp_path: Path):
    """Ensures ValueError is raised for malformed JSON."""
    invalid_file = tmp_path / "invalid.jsonl"
    invalid_file.write_text('{"params": {"length": 0.1}, ...')
    with pytest.raises(ValueError, match="Invalid JSON on line 1"):
        validate_dataset(str(invalid_file))

def test_validate_missing_params_key(tmp_path: Path):
    """Ensures ValueError is raised when 'params' key is missing."""
    invalid_file = tmp_path / "missing_key.jsonl"
    line = {"s11": [{"real": 0.1, "imag": 0.1}]}
    invalid_file.write_text(json.dumps(line))
    with pytest.raises(ValueError, match="Missing 'params' or 's11' field on line 1"):
        validate_dataset(str(invalid_file))

def test_validate_missing_s11_key(tmp_path: Path):
    """Ensures ValueError is raised when 's11' key is missing."""
    invalid_file = tmp_path / "missing_key.jsonl"
    line = {"params": {"length": 0.1}}
    invalid_file.write_text(json.dumps(line))
    with pytest.raises(ValueError, match="Missing 'params' or 's11' field on line 1"):
        validate_dataset(str(invalid_file))

def test_validate_inconsistent_freq_points(tmp_path: Path):
    """Ensures ValueError is raised for inconsistent s11 list lengths."""
    invalid_file = tmp_path / "inconsistent.jsonl"
    lines = [
        {"params": {"length": 0.1}, "s11": [{"real": 0.1, "imag": 0.1}]},
        {"params": {"length": 0.2}, "s11": [{"real": 0.1, "imag": 0.1}, {"real": 0.2, "imag": 0.2}]},
    ]
    invalid_file.write_text("\n".join(json.dumps(line) for line in lines))
    with pytest.raises(ValueError, match="Inconsistent number of frequency points on line 2"):
        validate_dataset(str(invalid_file))

def test_validate_non_finite_s11_value(tmp_path: Path):
    """Ensures ValueError is raised for non-finite s11 components."""
    invalid_file = tmp_path / "non_finite.jsonl"
    lines = [
        {"params": {"length": 0.1}, "s11": [{"real": float('inf'), "imag": 0.1}]},
    ]
    invalid_file.write_text("\n".join(json.dumps(line) for line in lines))
    with pytest.raises(ValueError, match="Non-finite s11 value found on line 1"):
        validate_dataset(str(invalid_file))

def test_validate_non_numeric_param_value(tmp_path: Path):
    """Ensures ValueError is raised for non-numeric parameter values."""
    invalid_file = tmp_path / "non_numeric_param.jsonl"
    line = {"params": {"length": "short"}, "s11": [{"real": 0.1, "imag": 0.1}]}
    invalid_file.write_text(json.dumps(line))
    with pytest.raises(ValueError, match="Parameter 'length' has non-numeric value on line 1"):
        validate_dataset(str(invalid_file))

def test_validate_empty_s11_list(tmp_path: Path):
    """Ensures ValueError is raised if s11 is an empty list."""
    invalid_file = tmp_path / "empty_s11.jsonl"
    line = {"params": {"length": 0.1}, "s11": []}
    invalid_file.write_text(json.dumps(line))
    with pytest.raises(ValueError, match="Field 's11' cannot be an empty list"):
        validate_dataset(str(invalid_file))

def test_validate_bad_s11_point_format(tmp_path: Path):
    """Ensures ValueError for incorrect s11 point format (e.g., a list instead of dict)."""
    invalid_file = tmp_path / "bad_s11_format.jsonl"
    line = {"params": {"length": 0.1}, "s11": [[0.1, 0.1]]} # Should be {"real":..., "imag":...}
    invalid_file.write_text(json.dumps(line))
    with pytest.raises(ValueError, match="Invalid s11 point format on line 1"):
        validate_dataset(str(invalid_file))
