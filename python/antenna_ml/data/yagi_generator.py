import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple

import numpy as np
from pydantic import BaseModel, Field

# --- Pydantic Data Models ---

class YagiParameters(BaseModel):
    """
    Parameters for a Yagi-Uda antenna with a fixed structure:
    1 reflector, 1 driven element, 2 directors.
    All lengths and spacings are in meters.
    """
    driven_length: float
    driven_radius: float
    reflector_length: float
    reflector_spacing: float
    director1_length: float
    director1_spacing: float
    director2_length: float
    director2_spacing: float

class YagiSimulationOutput(BaseModel):
    """Internal data structure for holding mock simulation output for a Yagi."""
    params: YagiParameters
    s11: List[Tuple[float, float]]
    far_field: List[float] = Field(default_factory=list)

# --- Mock Yagi Solver ---

def run_mock_yagi_solver(
    params: YagiParameters,
    freq_points: np.ndarray
) -> YagiSimulationOutput:
    """
    A mock solver for a Yagi-Uda antenna.

    This function generates a plausible S11 curve based on the Yagi's geometric
    parameters. The physics is heavily simplified for fast data generation.

    The model assumes:
    - The driven element's length sets the base resonant frequency.
    - Parasitic elements (reflector, directors) shift this frequency and
      increase the Q-factor (narrowing the bandwidth).
    """
    c = 299792458.0  # Speed of light in m/s

    # 1. Base resonance from the driven element (like a dipole)
    base_resonant_freq = c / (2 * params.driven_length)

    # 2. Frequency shift from parasitic elements (simplified model)
    # Reflector is longer -> inductive -> lowers resonant frequency
    freq_shift_reflector = -0.15 * base_resonant_freq * \
        (params.reflector_length / params.driven_length - 1.0) / (params.reflector_spacing / params.driven_length)
    
    # Directors are shorter -> capacitive -> raises resonant frequency
    freq_shift_dir1 = 0.25 * base_resonant_freq * \
        (1.0 - params.director1_length / params.driven_length) / (params.director1_spacing / params.driven_length)
    freq_shift_dir2 = 0.20 * base_resonant_freq * \
        (1.0 - params.director2_length / params.driven_length) / (params.director2_spacing / params.driven_length)

    resonant_freq = base_resonant_freq + freq_shift_reflector + freq_shift_dir1 + freq_shift_dir2

    # 3. Q-factor increases with more elements
    base_q_factor = 10.0 * (params.driven_length / (20 * params.driven_radius))
    # Add a multiplier for the parasitic elements
    q_factor = base_q_factor * 2.5 

    # 4. Generate S11 curve (similar to dipole solver)
    s11_mag_db = -35 * (1 / (1 + q_factor**2 * ((freq_points / resonant_freq) - (resonant_freq / freq_points))**2))
    s11_mag_linear = 10**(s11_mag_db / 20.0)

    # Add some phase variation
    s11_phase = np.pi * (freq_points / resonant_freq - 1) + np.random.uniform(-0.05, 0.05, size=len(freq_points))

    s11_real = s11_mag_linear * np.cos(s11_phase)
    s11_imag = s11_mag_linear * np.sin(s11_phase)

    s11_complex_pairs = list(zip(s11_real.tolist(), s11_imag.tolist()))

    return YagiSimulationOutput(
        params=params,
        s11=s11_complex_pairs,
        far_field=[]
    )

# --- Data Generation and Versioning ---

def generate_yagi_dataset(
    num_simulations: int,
    output_path: Path,
    freq_range: Tuple[float, float],
    num_freq_points: int,
    schema_version: str = "1.0",
):
    """
    Generates a dataset for Yagi antennas and saves it to a JSONL file.
    Also creates a companion metadata file for versioning.

    The parameter sampling uses relative factors for element lengths to ensure
    physically plausible geometries.
    """
    print(f"Generating {num_simulations} Yagi simulation results to {output_path}...")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Define sampling ranges (partly absolute, partly relative)
    # These ranges are chosen for designs around 0.4-0.8 GHz (lambda ~ 0.37-0.75m)
    param_sampling_config = {
        "driven_length": (0.15, 0.35),  # Absolute range in meters
        "driven_radius": (0.001, 0.005), # Absolute range in meters
        "reflector_length_factor": (1.03, 1.08), # Relative to driven_length
        "reflector_spacing_factor": (0.15, 0.25), # Relative to driven_length (as wavelength proxy)
        "director1_length_factor": (0.92, 0.97), # Relative to driven_length
        "director1_spacing_factor": (0.18, 0.30), # Relative to driven_length
        "director2_length_factor": (0.88, 0.93), # Relative to director1_length
        "director2_spacing_factor": (0.20, 0.35), # Relative to driven_length
    }

    with open(output_path, "w") as f:
        freq_points = np.linspace(freq_range[0], freq_range[1], num_freq_points)

        for i in range(num_simulations):
            # 1. Sample parameters using a mix of absolute and relative ranges
            driven_len = np.random.uniform(*param_sampling_config["driven_length"])
            dir1_len = driven_len * np.random.uniform(*param_sampling_config["director1_length_factor"])
            
            params_dict = {
                "driven_length": driven_len,
                "driven_radius": np.random.uniform(*param_sampling_config["driven_radius"]),
                "reflector_length": driven_len * np.random.uniform(*param_sampling_config["reflector_length_factor"]),
                "reflector_spacing": driven_len * np.random.uniform(*param_sampling_config["reflector_spacing_factor"]),
                "director1_length": dir1_len,
                "director1_spacing": driven_len * np.random.uniform(*param_sampling_config["director1_spacing_factor"]),
                "director2_length": dir1_len * np.random.uniform(*param_sampling_config["director2_length_factor"]),
                "director2_spacing": driven_len * np.random.uniform(*param_sampling_config["director2_spacing_factor"]),
            }
            yagi_params = YagiParameters(**params_dict)

            # 2. Run the mock solver
            sim_output = run_mock_yagi_solver(yagi_params, freq_points)

            # 3. Format for JSONL file (conforming to SimulationResult schema)
            s11_for_json = [{"real": r, "imag": i} for r, i in sim_output.s11]
            record = {
                "params": sim_output.params.model_dump(),
                "s11": s11_for_json,
                "far_field": sim_output.far_field,
            }
            f.write(json.dumps(record) + "\n")

            if (i + 1) % 200 == 0:
                print(f"  ...generated {i+1}/{num_simulations} samples.")

    # 4. Write metadata file for versioning
    metadata_path = output_path.with_suffix(".meta.json")
    metadata = {
        "dataset_name": output_path.stem,
        "generation_timestamp_utc": datetime.utcnow().isoformat(),
        "schema_version": schema_version,
        "antenna_type": "Yagi-Uda (1R-1DE-2D)",
        "generator_config": {
            "num_simulations": num_simulations,
            "freq_range_hz": freq_range,
            "num_freq_points": num_freq_points,
            "param_sampling_config": param_sampling_config,
            "solver": "run_mock_yagi_solver_v1",
        }
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Dataset generation complete. Metadata saved to {metadata_path}")
