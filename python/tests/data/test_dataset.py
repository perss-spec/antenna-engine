import json
import pytest
from pathlib import Path

from data.models import SimulationData
from data.dataset import AntennaDataset


@pytest.fixture
def valid_dataset_file(tmp_path: Path) -> Path:
    """Creates a temporary valid JSONL dataset file with 10 entries."""
    dataset_path = tmp_path / "valid_data.jsonl"
    lines = []
    for i in range(10):
        line = {
            "params": {"length": 0.1 + i * 0.01, "width": 0.05},
            "s11": [[-20.1, -1.5], [-15.2 - i, -3.4]],
            "far_field": [i]
        }
        lines.append(json.dumps(line))
    dataset_path.write_text("\n".join(lines))
    return dataset_path


def test_simulation_data_model():
    """Tests direct instantiation and validation of the SimulationData model."""
    data = {
        "params": {"length": 0.1, "width": 0.05},
        "s11": [[-20.1, -1.5], [-15.2, -3.4]],
        "far_field": []
    }
    sim_data = SimulationData.model_validate(data)
    assert sim_data.params["length"] == 0.1
    assert sim_data.s11[0] == (-20.1, -1.5)


def test_load_valid_dataset(valid_dataset_file: Path):
    """Tests loading a dataset from a well-formed JSONL file."""
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)
    assert len(dataset) == 10
    assert isinstance(dataset[0], SimulationData)
    assert dataset[0].params == {"length": 0.1, "width": 0.05}
    assert dataset[9].far_field == [9]


def test_load_nonexistent_file():
    """Ensures loading from a non-existent path raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        AntennaDataset.from_jsonl("nonexistent_file.jsonl")


def test_load_invalid_json_format(tmp_path: Path):
    """Ensures loading a file with malformed JSON raises a ValueError."""
    dataset_path = tmp_path / "invalid.jsonl"
    dataset_path.write_text('{"params": {"length": 0.1}, ... ')

    with pytest.raises(ValueError, match="Error parsing line 1"):
        AntennaDataset.from_jsonl(dataset_path)


def test_load_invalid_data_structure(tmp_path: Path):
    """Ensures loading data with missing keys raises a ValueError."""
    dataset_path = tmp_path / "invalid_structure.jsonl"
    # 's11' key is missing
    line = '{"params": {"length": 0.1}, "far_field": []}'
    dataset_path.write_text(line)

    with pytest.raises(ValueError, match="Error parsing line 1"):
        AntennaDataset.from_jsonl(dataset_path)


def test_dataset_split(valid_dataset_file: Path):
    """Tests the dataset splitting logic for correct sizes."""
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)
    train_set, val_set = dataset.split(val_size=0.2, random_state=42)

    assert len(train_set) == 8
    assert len(val_set) == 2
    assert len(train_set) + len(val_set) == len(dataset)


def test_dataset_split_reproducibility(valid_dataset_file: Path):
    """Ensures that splitting with the same random_state is deterministic."""
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)

    train1, val1 = dataset.split(random_state=42)
    train2, val2 = dataset.split(random_state=42)
    train3, val3 = dataset.split(random_state=101)

    # Ensure the two splits with the same seed are identical
    assert [s.params for s in train1.simulations] == [s.params for s in train2.simulations]
    assert [s.params for s in val1.simulations] == [s.params for s in val2.simulations]

    # Ensure the split with a different seed is different
    assert [s.params for s in train1.simulations] != [s.params for s in train3.simulations]


def test_dataset_split_edge_cases(valid_dataset_file: Path):
    """Tests edge cases for the split method."""
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)

    with pytest.raises(ValueError, match="val_size must be a float between 0 and 1"):
        dataset.split(val_size=1.5)

    with pytest.raises(ValueError, match="val_size must be a float between 0 and 1"):
        dataset.split(val_size=0)

    # Dataset of 10, val_size=0.95 -> 9 val, 1 train. Should work.
    train, val = dataset.split(val_size=0.9)
    assert len(train) == 1
    assert len(val) == 9

    # Test a case that results in a zero-sized val split -> should raise
    # 4 items, val_size=0.2 -> int(4*0.2) = 0 val -> error
    small_dataset = AntennaDataset(dataset.simulations[:4])
    with pytest.raises(ValueError, match="too small to create a valid split"):
        small_dataset.split(val_size=0.2)

    # 5 items, val_size=0.1 -> int(5*0.1) = 0 val -> error
    five_item_dataset = AntennaDataset(dataset.simulations[:5])
    with pytest.raises(ValueError, match="too small to create a valid split"):
        five_item_dataset.split(val_size=0.1)
