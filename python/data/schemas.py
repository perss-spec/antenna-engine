from pydantic import BaseModel, Field
from typing import List, Dict


class SimulationData(BaseModel):
    """Represents a single FDTD simulation result.

    This model is used for serializing/deserializing data from the JSONL dataset.
    It must be kept in sync with the corresponding Rust and TypeScript types.
    """

    params: Dict[str, float] = Field(
        ...,
        description="Input antenna parameters, normalized to [0, 1] range."
    )

    s11: List[List[float]] = Field(
        ...,
        description="S11 scattering parameter across a frequency range. "
                    "Each item is a [real, imaginary] pair."
    )

    # far_field: List[List[float]] = Field(
    #     default=None,
    #     description="Far-field gain pattern. Optional for now."
    # )
