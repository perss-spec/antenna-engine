from pydantic import BaseModel, Field


class OptimizationResult(BaseModel):
    """
    Data model for the result of an antenna optimization process.
    """
    optimal_length: float = Field(
        ...,
        description="The optimal length of the dipole found by the optimizer (in meters)."
    )
    min_s11_mag: float = Field(
        ...,
        description="The minimum S11 magnitude (linear scale) achieved at the optimal length and target frequency."
    )
    status: int = Field(
        ...,
        description="Termination status of the optimizer (0 for success)."
    )
    message: str = Field(
        ...,
        description="Message from the optimizer describing the termination reason."
    )
    n_iterations: int = Field(
        ...,
        description="Number of function evaluations performed by the optimizer."
    )
