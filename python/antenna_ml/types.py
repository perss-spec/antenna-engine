"""
Pydantic models for data exchange between Python, Rust, and TypeScript.
"""
from pydantic import BaseModel, Field

class AntennaParameters(BaseModel):
    """
    Defines the geometric parameters of an antenna.
    These parameters are the inputs to the surrogate model.
    """
    length: float = Field(
        ...,
        gt=0,
        description="Length of the primary antenna element in millimeters.",
        examples=[10.5]
    )
    width: float = Field(
        ...,
        gt=0,
        description="Width of the primary antenna element in millimeters.",
        examples=[1.2]
    )
    substrate_height: float = Field(
        ...,
        gt=0,
        description="Height of the substrate material in millimeters.",
        examples=[1.6]
    )

class GainPrediction(BaseModel):
    """
    Represents the predicted gain of an antenna.
    This is the output from the surrogate model.
    """
    gain_db: float = Field(
        ...,
        description="Predicted gain of the antenna in decibels (dB).",
        examples=[8.2]
    )
