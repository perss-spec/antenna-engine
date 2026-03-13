"""Tests for data.dataset.AntennaDataset with current SimulationData model."""

import json
import pytest
from pathlib import Path

from data.models import SimulationData
from data.dataset import AntennaDataset


@pytest.fixture
def valid_dataset_file(tmp_path: Path) -> Path:
    dataset_path = tmp_path / "valid_data.jsonl"
    lines = []
    for i in range(10):
        line = {
            "params": {"length": 0.1 + i * 0.01, "width": 0.05},
            "s11": [[-20.1, -1.5], [-15.2 - i, -3.4]],
            "far_field": [i],
        }
        lines.append(json.dumps(line))
    dataset_path.write_text("\n".join(lines))
    return dataset_path


def test_dataset_len(valid_dataset_file: Path):
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)
    assert len(dataset) == 10


def test_dataset_getitem(valid_dataset_file: Path):
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)
    item = dataset[0]
    assert isinstance(item, SimulationData)
    assert item.params["length"] == 0.1
    assert item.s11[0] == (-20.1, -1.5)


def test_load_nonexistent_file():
    with pytest.raises(FileNotFoundError):
        AntennaDataset.from_jsonl("nonexistent_file.jsonl")


def test_load_invalid_json(tmp_path: Path):
    path = tmp_path / "invalid.jsonl"
    path.write_text('{"params": {"length": 0.1}, ... ')
    with pytest.raises(ValueError, match="Error parsing line 1"):
        AntennaDataset.from_jsonl(path)


def test_dataset_split(valid_dataset_file: Path):
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)
    train_set, val_set = dataset.split(val_size=0.2, random_state=42)
    assert len(train_set) == 8
    assert len(val_set) == 2
    assert len(train_set) + len(val_set) == len(dataset)


def test_dataset_split_reproducibility(valid_dataset_file: Path):
    dataset = AntennaDataset.from_jsonl(valid_dataset_file)
    train1, val1 = dataset.split(random_state=42)
    train2, val2 = dataset.split(random_state=42)
    assert [s.params for s in train1.simulations] == [s.params for s in train2.simulations]
    assert [s.params for s in val1.simulations] == [s.params for s in val2.simulations]
