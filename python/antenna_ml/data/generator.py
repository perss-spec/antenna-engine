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
    Generates a dataset by running multiple mock simulations.

    Args:
        num_simulations: The number of data points to generate.
        output_path: Path to the output .jsonl file.
        param_ranges: A dictionary defining the sampling range for each parameter.
        freq_range: The (start, end) frequency range in Hz.
        num_freq_points: The number of frequency points to sample.
    """
    print(f"Generating {num_simulations} simulations...")
    print(f"Saving dataset to {output_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    freq_points = np.linspace(freq_range[0], freq_range[1], num_freq_points)

    param_keys = list(param_ranges.keys())
    d = len(param_keys)
    lows = np.array([param_ranges[k][0] for k in param_keys])
    highs = np.array([param_ranges[k][1] for k in param_keys])

    try:
        from scipy.stats import qmc
        sampler = qmc.LatinHypercube(d=d)
        sample_points = sampler.random(n=num_simulations)
        scaled_samples = qmc.scale(sample_points, lows, highs)
        print("Using Latin Hypercube Sampling for parameter generation.")
    except ImportError:
        print("Warning: scipy not found. Falling back to random sampling. "
              "Install scipy for better parameter space coverage (`pip install scipy`).")
        sample_points = np.random.rand(num_simulations, d)
        scaled_samples = lows + sample_points * (highs - lows)

    with open(output_path, 'w') as f:
        for i in range(num_simulations):
            param_values = scaled_samples[i]
            params_dict = {key: val for key, val in zip(param_keys, param_values)}
            
            dipole_params = DipoleParameters(**params_dict)

            result = run_mock_solver(dipole_params, freq_points)

            f.write(result.model_dump_json() + '\n')

            if (i + 1) % 20 == 0 or (i + 1) == num_simulations:
                print(f"  ... generated {i + 1}/{num_simulations} samples")

    print("Dataset generation complete.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generate training data for antenna surrogate models.")
    parser.add_argument(
        "-n", "--num-simulations",
        type=int,
        default=200,
        help="Number of simulations to run (default: 200)."
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default="python/data/dipole_dataset.jsonl",
        help="Output file path for the JSON Lines dataset."
    )
    args = parser.parse_args()

    # Example: a dipole for ~1-2 GHz applications
    DIPOLE_PARAM_RANGES = {
        "length": (0.07, 0.15),  # meters, for resonance around 1-2 GHz
        "radius": (0.0005, 0.002), # meters (0.5mm to 2mm)
    }

    FREQ_RANGE_HZ = (1e9, 3e9) # 1 GHz to 3 GHz
    NUM_FREQ_POINTS = 101

    generate_dataset(
        num_simulations=args.num_simulations,
        output_path=Path(args.output),
        param_ranges=DIPOLE_PARAM_RANGES,
        freq_range=FREQ_RANGE_HZ,
        num_freq_points=NUM_FREQ_POINTS,
    )
