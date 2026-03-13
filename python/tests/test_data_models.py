"""Tests for data.models.SimulationData — the current Pydantic schema."""

import pytest
from pydantic import ValidationError

from data.models import SimulationData


def test_simulation_data_valid():
    data = SimulationData(
        params={"length": 0.1, "width": 0.05},
        s11=[(-20.1, -1.5), (-15.2, -3.4)],
        far_field=[1.0, 2.0],
    )
    assert data.params["length"] == 0.1
    assert len(data.s11) == 2
    assert data.s11[0] == (-20.1, -1.5)


def test_simulation_data_serialization():
    data = SimulationData(
        params={"length": 0.1, "radius": 0.003},
        s11=[(-10.0, -5.0)],
        far_field=[],
    )
    json_str = data.model_dump_json()
    assert '"length"' in json_str
    assert '"s11"' in json_str


def test_simulation_data_missing_s11():
    with pytest.raises(ValidationError):
        SimulationData(params={"length": 0.1}, far_field=[])


def test_simulation_data_missing_params():
    with pytest.raises(ValidationError):
        SimulationData(s11=[(-1.0, -0.5)], far_field=[])


def test_simulation_data_model_validate():
    raw = {
        "params": {"length": 0.12, "radius": 0.002},
        "s11": [[-20.1, -1.5], [-15.2, -3.4]],
        "far_field": [],
    }
    sim = SimulationData.model_validate(raw)
    assert sim.params["radius"] == 0.002
    assert sim.s11[0] == (-20.1, -1.5)
