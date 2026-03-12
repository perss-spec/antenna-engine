import json
import numpy as np
import random
from pathlib import Path
from typing import Dict, List, Any

def generate_mock_data(
    output_path: str,
    num_samples: int,
    param_config: Dict[str, Dict[str, float]],
    num_freq_points: int
) -> None:
    """
    Generates a mock dataset in JSON Lines format for training surrogate models.

    This simulates the output of an FDTD solver.

    Args:
        output_path (str): Path to the output .jsonl file.
        num_samples (int): The number of simulation samples to generate.
        param_config (Dict[str, Dict[str, float]]): A dictionary defining the parameters
            and their ranges. Example:
            {
                "length": {"min": 0.05, "max": 0.15},
                "width": {"min": 0.005, "max": 0.015}
            }
        num_freq_points (int): The number of frequency points for the S11 curve.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for _ in range(num_samples):
            # 1. Generate random parameters within the specified ranges
            params = {
                name: random.uniform(p_range["min"], p_range["max"])
                for name, p_range in param_config.items()
            }

            # 2. Generate a plausible but fake S11 curve
            primary_param = next(iter(params.values()))
            resonant_freq = 1.0 / (2 * primary_param) # Fake physics
            freqs = np.linspace(resonant_freq * 0.5, resonant_freq * 1.5, num_freq_points)
            
            q_factor = 20.0
            s11_mag_db = -20 * np.log10(1 + (q_factor**2) * ((freqs / resonant_freq) - 1)**2)
            s11_mag_db = np.clip(s11_mag_db, -40, 0)
            s11_mag_db += np.random.normal(0, 0.5, size=s11_mag_db.shape)

            s11_mag_linear = 10**(s11_mag_db / 20.0)
            s11_phase = np.random.uniform(-np.pi, np.pi, size=num_freq_points)
            
            s11_real = s11_mag_linear * np.cos(s11_phase)
            s11_imag = s11_mag_linear * np.sin(s11_phase)
            
            s11_interleaved = np.ravel(np.column_stack((s11_real, s11_imag))).tolist()

            # 3. Generate placeholder far-field data
            far_field: List[Any] = []

            # 4. Write to file as a JSON line
            record = {
                "params": params,
                "s11": s11_interleaved,
                "far_field": far_field
            }
            f.write(json.dumps(record) + '\n')
