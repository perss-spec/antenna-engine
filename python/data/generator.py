import json
import argparse
from pathlib import Path

import numpy as np

# Reuse the existing mock solver and Pydantic models for consistency
from antenna_ml.data.generator import run_mock_solver, DipoleParameters


def generate_s11_dataset(
    num_simulations: int,
    output_path: Path,
    param_ranges: dict,
    freq_range: tuple[float, float],
    num_freq_points: int,
):
    """
    Generates a dataset by running multiple mock simulations and saving them
    to a JSON Lines file, conforming to the SimulationResult schema.

    Args:
        num_simulations: The number of data points to generate.
        output_path: Path to the output .jsonl file.
        param_ranges: A dictionary defining the min/max for each parameter.
                      Example: {"length": (0.05, 0.15), "radius": (0.001, 0.005)}
        freq_range: A tuple (start_freq_hz, end_freq_hz).
        num_freq_points: The number of frequency points to simulate.
    """
    print(f"Generating {num_simulations} simulation results to {output_path}...")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        freq_points = np.linspace(freq_range[0], freq_range[1], num_freq_points)

        for i in range(num_simulations):
            # 1. Generate random parameters within the specified ranges
            params = {
                key: np.random.uniform(low=v_min, high=v_max)
                for key, (v_min, v_max) in param_ranges.items()
            }
            dipole_params = DipoleParameters(**params)

            # 2. Run the mock solver
            sim_output = run_mock_solver(dipole_params, freq_points)

            # 3. Convert S11 output to the format expected by SimulationResult
            # The solver returns List[Tuple[float, float]], but the dataset schema
            # expects List[ComplexNumber], which serializes to List[Dict[str, float]].
            s11_for_json = [{"real": r, "imag": i} for r, i in sim_output.s11]

            # 4. Create the final record and write to JSONL file
            record = {
                "params": sim_output.params.model_dump(),
                "s11": s11_for_json,
                "far_field": sim_output.far_field,  # Keep as empty list
            }
            f.write(json.dumps(record) + "\n")

            if (i + 1) % 100 == 0:
                print(f"  ...generated {i+1}/{num_simulations} samples.")

    print("Dataset generation complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate mock antenna simulation data.")
    parser.add_argument(
        "--num-samples",
        type=int,
        default=1000,
        help="Number of simulation samples to generate.",
    )
    parser.add_argument(
        "--output-file",
        type=str,
        default="data/generated/dipole_s11_dataset.jsonl",
        help="Path to the output JSON Lines file.",
    )
    args = parser.parse_args()

    # Default parameter and frequency configuration
    PARAM_RANGES = {
        "length": (0.05, 0.15),  # meters, for frequencies around 1-3 GHz
        "radius": (0.001, 0.005), # meters
    }
    FREQ_RANGE = (1e9, 4e9)  # 1-4 GHz
    NUM_FREQ_POINTS = 101

    generate_s11_dataset(
        num_simulations=args.num_samples,
        output_path=Path(args.output_file),
        param_ranges=PARAM_RANGES,
        freq_range=FREQ_RANGE,
        num_freq_points=NUM_FREQ_POINTS,
    )
