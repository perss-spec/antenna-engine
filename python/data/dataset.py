import json
import random
from pathlib import Path
from typing import List, Tuple

from pydantic import ValidationError

from .models import SimulationData


class AntennaDataset:
    """
    Manages a collection of antenna simulation data.

    This class provides functionality for loading datasets from JSONL files and
    splitting them into training and validation sets in a reproducible manner.
    """

    def __init__(self, simulations: List[SimulationData]):
        """Initializes the dataset with a list of simulation data points."""
        self.simulations = simulations

    def __len__(self) -> int:
        """Returns the total number of simulations in the dataset."""
        return len(self.simulations)

    def __getitem__(self, idx: int) -> SimulationData:
        """Retrieves a simulation data point by its index."""
        return self.simulations[idx]

    @classmethod
    def from_jsonl(cls, path: str | Path) -> "AntennaDataset":
        """
        Loads an antenna dataset from a JSON Lines (.jsonl) file.

        Each line of the file is expected to be a valid JSON object corresponding
        to the `SimulationData` model.

        Args:
            path: The path to the .jsonl file.

        Returns:
            An instance of `AntennaDataset` containing the loaded data.

        Raises:
            FileNotFoundError: If the specified file does not exist.
            ValueError: If the file contains malformed JSON or data that doesn't
                        match the `SimulationData` schema.
        """
        path = Path(path)
        if not path.is_file():
            raise FileNotFoundError(f"Dataset file not found: {path}")

        simulations: List[SimulationData] = []
        with path.open('r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    simulations.append(SimulationData.model_validate(data))
                except (json.JSONDecodeError, ValidationError) as e:
                    raise ValueError(f"Error parsing line {i + 1} in {path}: {e}") from e

        return cls(simulations)

    def split(
        self, val_size: float = 0.2, random_state: int | None = 42
    ) -> Tuple["AntennaDataset", "AntennaDataset"]:
        """
        Splits the dataset into training and validation sets.

        Args:
            val_size: The proportion of the dataset to allocate to the validation set.
                      Must be between 0 and 1.
            random_state: A seed for the random number generator to ensure
                          reproducible splits. If None, the split will be random.

        Returns:
            A tuple containing the training dataset and the validation dataset.

        Raises:
            ValueError: If `val_size` is not between 0 and 1, or if the dataset
                        is too small to create a non-empty split.
        """
        if not (0 < val_size < 1):
            raise ValueError("val_size must be a float between 0 and 1.")

        dataset_size = len(self)
        val_count = int(dataset_size * val_size)
        train_count = dataset_size - val_count

        if train_count == 0 or val_count == 0:
            raise ValueError(
                f"Dataset size ({dataset_size}) is too small to create a valid split "
                f"with val_size={val_size}. Resulting sizes: train={train_count}, val={val_count}."
            )

        indices = list(range(dataset_size))
        if random_state is not None:
            # Use a new Random instance to not affect the global state
            rng = random.Random(random_state)
            rng.shuffle(indices)
        else:
            random.shuffle(indices)

        train_indices = indices[:train_count]
        val_indices = indices[train_count:]

        train_sims = [self.simulations[i] for i in train_indices]
        val_sims = [self.simulations[i] for i in val_indices]

        return AntennaDataset(train_sims), AntennaDataset(val_sims)
