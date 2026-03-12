# Legacy package — content migrated to antenna_ml.data
# Kept for backward compatibility with existing tests
from .models import AntennaParameters, SimulationResult, TrainingSample
from .dataset import AntennaDataset

__all__ = ["AntennaParameters", "SimulationResult", "TrainingSample", "AntennaDataset"]
