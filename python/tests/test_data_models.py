import pytest
from pydantic import ValidationError

from data.models import AntennaParameters, SimulationResult, TrainingSample

def test_antenna_parameters_valid():
    params = AntennaParameters(
        patch_length=30.0,
        patch_width=40.0,
        substrate_height=1.5,
        substrate_epsilon=4.4
    )
    assert params.patch_length == 30.0
    assert params.model_dump_json() is not None

def test_antenna_parameters_invalid():
    with pytest.raises(ValidationError):
        # patch_length must be > 0
        AntennaParameters(
            patch_length=-5.0,
            patch_width=40.0,
            substrate_height=1.5,
            substrate_epsilon=4.4
        )
    with pytest.raises(ValidationError):
        # substrate_epsilon must be > 1
        AntennaParameters(
            patch_length=30.0,
            patch_width=40.0,
            substrate_height=1.5,
            substrate_epsilon=0.9
        )

def test_simulation_result_valid():
    result = SimulationResult(
        frequencies_ghz=[2.4, 2.5],
        s11_db=[-10.1, -15.2]
    )
    assert len(result.frequencies_ghz) == 2

def test_simulation_result_mismatch_len():
    with pytest.raises(ValueError, match="Length of frequencies and s11_db must be the same"):
        SimulationResult(
            frequencies_ghz=[2.4],
            s11_db=[-10.1, -15.2]
        )

def test_training_sample_creation():
    params = AntennaParameters(patch_length=30, patch_width=40, substrate_height=1.5, substrate_epsilon=4.4)
    result = SimulationResult(frequencies_ghz=[2.4], s11_db=[-10])
    sample = TrainingSample(parameters=params, result=result)
    assert sample.parameters.patch_width == 40.0
    assert sample.result.s11_db[0] == -10
