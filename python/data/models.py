from pydantic import BaseModel
from typing import Any, Dict, List, Tuple


class SimulationData(BaseModel):
    """
    Represents a single FDTD simulation result.

    This model validates the structure of one line in the JSONL dataset,
    ensuring that all data loaded into the training pipeline conforms to the
    expected schema.

    Attributes:
        params: A dictionary of antenna geometric parameters (e.g., length, width)
                and their corresponding float values.
        s11: A list of S11 parameter values. Each value is a tuple representing
             a complex number as (real, imaginary).
        far_field: Data for the far-field radiation pattern. The structure is kept
                   flexible (`List[Any]`) for now to accommodate different formats.
    """
    params: Dict[str, float]
    s11: List[Tuple[float, float]]
    far_field: List[Any]
