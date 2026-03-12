import pytest
from pydantic import ValidationError

from antenna_ml.types import AntennaParameters, GainPrediction

def test_antenna_parameters_creation():
    """Tests successful creation of AntennaParameters."""
    params = AntennaParameters(length=10.0, width=1.0, substrate_height=1.5)
    assert params.length == 10.0
    assert params.width == 1.0
    assert params.substrate_height == 1.5

def test_antenna_parameters_validation():
    """Tests validation constraints for AntennaParameters."""
    # Test for non-positive values
    with pytest.raises(ValidationError):
        AntennaParameters(length=0, width=1.0, substrate_height=1.5)
    with pytest.raises(ValidationError):
        AntennaParameters(length=10.0, width=-1.0, substrate_height=1.5)
    
    # Test for missing values
    with pytest.raises(ValidationError):
        AntennaParameters(length=10.0, width=1.0)

def test_gain_prediction_creation():
    """Tests successful creation of GainPrediction."""
    prediction = GainPrediction(gain_db=5.5)
    assert prediction.gain_db == 5.5

def test_gain_prediction_validation():
    """Tests validation for GainPrediction."""
    # Test for missing value
    with pytest.raises(ValidationError):
        GainPrediction()
    
    # Test for wrong type
    with pytest.raises(ValidationError):
        GainPrediction(gain_db="high")
