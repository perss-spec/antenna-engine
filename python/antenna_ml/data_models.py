from pydantic import BaseModel, Field
from typing import Dict

class OptimizationResult(BaseModel):
    """
    Holds the result of an optimization process.
    """
    optimal_params: Dict[str, float] = Field(
        ...,
        description="A dictionary of the optimal antenna parameters found."
    )
    objective_value: float = Field(
        ...,
        description="The value of the objective function at the optimal parameters (e.g., S11 in dB)."
    )
