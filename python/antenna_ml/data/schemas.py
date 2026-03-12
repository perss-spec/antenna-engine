from pydantic import BaseModel, Field
from typing import List

class AntennaParameters(BaseModel):
    """
    Input parameters for a generic antenna design.
    These values will be the input features for the surrogate model.
    """
    length: float = Field(..., description="Length of the antenna patch in meters.")
    width: float = Field(..., description="Width of the antenna patch in meters.")
    substrate_height: float = Field(..., description="Height of the substrate in meters.")
    substrate_epsilon: float = Field(..., ge=1.0, description="Dielectric constant of the substrate.")

class SimulationOutput(BaseModel):
    """
    Output results from an electromagnetic (EM) simulation.
    These values will be the target labels for the surrogate model.
    """
    resonant_frequency: float = Field(..., description="Primary resonant frequency in Hz.")
    gain_db: float = Field(..., description="Gain of the antenna in dBi at the resonant frequency.")
    vswr: float = Field(..., gt=1.0, description="Voltage Standing Wave Ratio at the resonant frequency.")

class AntennaDataPoint(BaseModel):
    """
    A single data point combining antenna parameters and its corresponding
    simulation output.
    """
    params: AntennaParameters
    results: SimulationOutput
