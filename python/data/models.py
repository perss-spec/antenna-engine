from pydantic import BaseModel, Field
from typing import List

class AntennaParameters(BaseModel):
    """
    Defines the geometric and material properties of an antenna.
    These are the inputs to the EM simulation and the surrogate model.
    """
    patch_length: float = Field(..., gt=0, description="Length of the antenna patch in mm.")
    patch_width: float = Field(..., gt=0, description="Width of the antenna patch in mm.")
    substrate_height: float = Field(..., gt=0, description="Height of the substrate in mm.")
    substrate_epsilon: float = Field(..., gt=1, description="Dielectric constant of the substrate.")

class SimulationResult(BaseModel):
    """
    Represents the output of an EM simulation for a given set of antenna parameters.
    For simplicity, we model S11 parameters over a frequency range.
    """
    frequencies_ghz: List[float] = Field(..., description="List of frequencies in GHz.")
    s11_db: List[float] = Field(..., description="S11 parameter in dB for each frequency.")

    def model_post_init(self, __context):
        if len(self.frequencies_ghz) != len(self.s11_db):
            raise ValueError("Length of frequencies and s11_db must be the same.")

class TrainingSample(BaseModel):
    """
    A single data point for training, pairing antenna parameters with their
    corresponding simulation results.
    """
    parameters: AntennaParameters
    result: SimulationResult
