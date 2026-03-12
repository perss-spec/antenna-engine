import json
import pytest
from pydantic import ValidationError

from antenna_ml.data.simulation_data import SimulationResult, ComplexNumber


def test_complex_number_creation():
    c = ComplexNumber(real=1.0, imag=-0.5)
    assert c.real == 1.0
    assert c.imag == -0.5


def test_simulation_result_creation():
    sim_data = {
        "params": {"length": 0.1, "width": 0.05},
        "s11": [{"real": -10.0, "imag": -5.0}, {"real": -20.0, "imag": -2.0}],
        "far_field": None,
    }
    result = SimulationResult(**sim_data)
    assert result.params["length"] == 0.1
    assert len(result.s11) == 2
    assert result.s11[0].real == -10.0
    assert result.far_field is None


def test_simulation_result_serialization():
    sim_data = {
        "params": {"length": 0.1, "width": 0.05},
        "s11": [{"real": -10.0, "imag": -5.0}],
    }
    result = SimulationResult(**sim_data)
    # Pydantic v2 uses model_dump_json
    json_str = result.model_dump_json()
    reloaded_data = json.loads(json_str)

    assert reloaded_data["params"] == sim_data["params"]
    assert reloaded_data["s11"] == sim_data["s11"]


def test_invalid_simulation_data():
    # Missing 's11'
    invalid_data = {"params": {"length": 0.1}}
    with pytest.raises(ValidationError):
        SimulationResult(**invalid_data)

    # Incorrect type for a parameter
    invalid_data_2 = {
        "params": {"length": "short"},
        "s11": [{"real": -10.0, "imag": -5.0}],
    }
    with pytest.raises(ValidationError):
        SimulationResult(**invalid_data_2)
