import json
import argparse
from pathlib import Path
from typing import List, Dict, Tuple

import numpy as np
from pydantic import BaseModel, Field

# --- Pydantic Data Models (to match Rust/TS) ---

class DipoleParameters(BaseModel):
    """Parameters for a simple dipole antenna."""
    length: float = Field(..., description="Length of the dipole in meters.")
    radius: float = Field(..., description="Radius of the wire in meters.")

class SimulationOutput(BaseModel):
    """Output of a single antenna simulation."""
    params: DipoleParameters
    # S11 is a list of [real, imaginary] pairs for each frequency point
    s11: List[Tuple[float, float]]
    # Placeholder for far-field data, not implemented in this version
    far_field: List[float] = Field(default_factory=list)


# --- Mock Solver ---

def run_mock_solver(
    params: DipoleParameters,
    freq_points: np.ndarray
) -> SimulationOutput:
    """
    A mock antenna solver function.

    This function simulates the behavior of a real FDTD/MoM solver by generating
    plausible-looking S11 data based on the input parameters. In a real
    scenario, this would be a call to an external simulation engine.

    Args:
        params: The antenna parameters.
        freq_points: An array of frequencies to calculate S11 for.

    Returns:
        A SimulationOutput object containing the results.
    """
    # A very simplistic model: resonance frequency is inversely proportional to length
    c = 299792458.0  # Speed of light in m/s
    resonant_freq = c / (2 * params.length)

    # Generate a plausible S11 curve (a dip around the resonant frequency)
    # Q-factor is made dependent on the length-to-radius ratio
    q_factor = 10.0 * (params.length / (20 * params.radius))
    s11_mag_db = -25 * (1 / (1 + q_factor**2 * ((freq_points / resonant_freq) - (resonant_freq / freq_points))**2))
    s11_mag_linear = 10**(s11_mag_db / 20.0)

    # Add some random phase and a slope related to resonance
    s11_phase = np.random.uniform(-0.1, 0.1, size=len(freq_points)) # Small random phase
    s11_phase += np.pi * (freq_points / resonant_freq - 1) # Add phase slope

    # Convert to real and imaginary parts
    s11_real = s11_mag_linear * np.cos(s11_phase)
    s11_imag = s11_mag_linear * np.sin(s11_phase)

    s11_complex_pairs = list(zip(s11_real.tolist(), s11_imag.tolist()))

    return SimulationOutput(
        params=params,
        s11=s11_complex_pairs,
        far_field=[] # Keep far-field empty for now
    )


# --- Data Generation Script ---

def generate_dataset(
    num_simulations: int,
    output_path: Path,
    param_ranges: Dict[str, Tuple[float, float]],
    freq_range: Tuple[float, float],
    num_freq_points: int,
):
    """
    Generates a dataset by running multiple mock simulations and saving them
    to a JSON Lines file.

    Args:
        num_simulations: The number of data points to generate.
        output_path: Path to the output .jsonl file.
        param_ranges: A dictionary defining the sampling range for each param.
        freq_range: A tuple (min_freq, max_freq) in Hz.
        num_freq_points: The number of frequency points in the sweep.
    """
    print(f"Generating {num_simulations} simulations...")
    print(f"Output file: {output_path}")
    print(f"Parameter ranges: {param_ranges}")
    print(f"Frequency range: {freq_range[0]/1e9:.2f} GHz to {freq_range[1]/1e9:.2f} GHz ({num_freq_points} points)")

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    freq_points = np.linspace(freq_range[0], freq_range[1], num_freq_points)

    with open(output_path, "w") as f:
        for i in range(num_simulations):
            # Use uniform random sampling. For better coverage, Latin Hypercube Sampling could be used.
            sampled_params = {
                key: np.random.uniform(low=low, high=high)
                for key, (low, high) in param_ranges.items()
            }
            
            dipole_params = DipoleParameters(**sampled_params)

            # Run the mock simulation
            sim_output = run_mock_solver(dipole_params, freq_points)

            # Write the result as a JSON line, conforming to the project's data format
            f.write(sim_output.model_dump_json() + "\n")

            if (i + 1) % 100 == 0 or (i + 1) == num_simulations:
                print(f"  ... generated {i + 1}/{num_simulations} samples")
    
    print(f"\nDataset generation complete. Data saved to {output_path}")

def main():
    """Main function to run the data generator from the command line."""
    parser = argparse.ArgumentParser(
        description="Generate mock simulation data for dipole antennas in JSONL format.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "-n", "--num-simulations",
        type=int,
        default=500,
        help="Number of simulations to generate."
    )
    parser.add_argument(
        "-o", "--output-path",
        type=Path,
        default=Path("datasets/dipole_s11_dataset.jsonl"),
        help="Path to the output JSONL file."
    )
    parser.add_argument(
        "--num-freq-points",
        type=int,
        default=101,
        help="Number of frequency points for the S11 curve."
    )
    args = parser.parse_args()

    # Define parameter ranges. These are based on a center frequency of 1.5 GHz (lambda=0.2m)
    # as a reasonable starting point.
    # Length: 0.1 to 2.0 wavelengths -> 0.02m to 0.4m
    # Radius: 0.001 to 0.05 wavelengths -> 0.0002m to 0.01m
    param_ranges = {
        "length": (0.02, 0.4),
        "radius": (0.0002, 0.01),
    }

    # Frequency range for the S11 curve, from 100 MHz to 3 GHz.
    freq_range = (100e6, 3e9)

    generate_dataset(
        num_simulations=args.num_simulations,
        output_path=args.output_path,
        param_ranges=param_ranges,
        freq_range=freq_range,
        num_freq_points=args.num_freq_points,
    )

if __name__ == "__main__":
    main()
