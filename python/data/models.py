from pydantic import BaseModel, Field
from typing import List


class AntennaParameters(BaseModel):
    """
    Defines the geometric and material properties of a microstrip patch antenna.
    All dimensions are in millimeters (mm).
    """
    patch_length: float = Field(
        ...,
        gt=0,
        description="Length of the antenna patch in mm."
    )
    patch_width: float = Field(
        ...,
        gt=0,
        description="Width of the antenna patch in mm."
    )
    substrate_height: float = Field(
        ...,
        gt=0,
        description="Height of the substrate in mm."
    )
    dielectric_constant: float = Field(
        ...,
        gt=1,
        description="Dielectric constant (epsilon_r) of the substrate material."
    )


class SimulationResults(BaseModel):
    """
    Represents the output of an electromagnetic (EM) simulation.
    For now, it focuses on the S11 parameter (return loss).
    """
    frequencies_ghz: List[float] = Field(
        ...,
        description="List of frequencies in GHz at which S11 was sampled."
    )
    s11_db: List[float] = Field(
        ...,
        description="S11 parameter (return loss) in dB, corresponding to the frequencies."
    )


class AntennaSample(BaseModel):
    """
    A single data sample, pairing antenna parameters with their simulation results.
    This is the fundamental unit of our dataset.
    """
    parameters: AntennaParameters
    results: SimulationResults
