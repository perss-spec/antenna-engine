"""Tests for data.generator.generate_s11_dataset."""

import json
from pathlib import Path

import pytest

from data.generator import generate_s11_dataset


@pytest.fixture
def generator_config(tmp_path: Path) -> dict:
    return {
        "num_simulations": 10,
        "output_path": tmp_path / "test_dataset.jsonl",
        "param_ranges": {"length": (0.05, 0.15), "radius": (0.001, 0.005)},
        "freq_range": (1e9, 2e9),
        "num_freq_points": 51,
    }


def test_file_creation(generator_config: dict):
    generate_s11_dataset(**generator_config)
    assert generator_config["output_path"].exists()


def test_file_content(generator_config: dict):
    generate_s11_dataset(**generator_config)
    lines = generator_config["output_path"].read_text().strip().split("\n")
    assert len(lines) == generator_config["num_simulations"]

    for line in lines:
        data = json.loads(line)
        assert "params" in data
        assert "s11" in data
        assert "far_field" in data
        assert len(data["params"]) == len(generator_config["param_ranges"])
        assert len(data["s11"]) == generator_config["num_freq_points"]
        assert "length" in data["params"]
        assert "radius" in data["params"]


def test_empty_generation(generator_config: dict):
    generator_config["num_simulations"] = 0
    generate_s11_dataset(**generator_config)
    content = generator_config["output_path"].read_text()
    assert content == ""
