from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ComplexNumber(BaseModel):
    """Represents a complex number with real and imaginary parts."""

    real: float = Field(..., description="The real part of the complex number.")
    imag: float = Field(..., description="The imaginary part of the complex number.")


class SimulationResult(BaseModel):
    """
    Represents the result of a single FDTD simulation for a given set of antenna parameters.
    This model corresponds to a single line in the JSONL dataset file.
    """

    params: Dict[str, float] = Field(
        ...,
        description="A dictionary of antenna parameters (e.g., 'length', 'width') and their float values.",
    )
    s11: List[ComplexNumber] = Field(
        ...,
        description="S11 scattering parameter curve. A list of complex numbers representing S11 at different frequency points.",
    )
    far_field: Optional[List[ComplexNumber]] = Field(
        None, description="Far-field gain pattern. Optional list of complex numbers."
    )
