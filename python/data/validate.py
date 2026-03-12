import json
import math
from pathlib import Path
from typing import Dict, Any, Tuple

def validate_dataset(path: str) -> Dict[str, Any]:
    """
    Reads a JSONL dataset file, validates its structure and content, and computes statistics.

    Checks for:
    - Valid JSON format per line.
    - Presence of 'params' and 's11' fields in each record.
    - Consistency in the number of frequency points ('s11' length).
    - Finiteness of s11 real and imaginary components.

    Args:
        path: The path to the .jsonl dataset file.

    Returns:
        A dictionary containing dataset statistics:
        - num_samples: Total number of valid records.
        - num_freq_points: Number of frequency points per sample.
        - param_ranges: A dict mapping each parameter name to its min and max values.
        - s11_range_db: A tuple with the min and max S11 magnitude in dB.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the dataset is empty, malformed, or inconsistent.
    """
    dataset_path = Path(path)
    if not dataset_path.is_file():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    num_samples = 0
    num_freq_points = None
    param_ranges: Dict[str, Dict[str, float]] = {}
    s11_min_db = float('inf')
    s11_max_db = float('-inf')

    with dataset_path.open('r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON on line {i + 1}: {e}") from e

            # Check for required fields
            if 'params' not in data or 's11' not in data:
                raise ValueError(f"Missing 'params' or 's11' field on line {i + 1}.")
            if not isinstance(data['params'], dict) or not isinstance(data['s11'], list):
                raise ValueError(f"Incorrect type for 'params' or 's11' on line {i + 1}.")

            # Check for frequency point consistency
            current_freq_points = len(data['s11'])
            if num_freq_points is None:
                num_freq_points = current_freq_points
                if num_freq_points == 0:
                    raise ValueError("Field 's11' cannot be an empty list.")
            elif num_freq_points != current_freq_points:
                raise ValueError(
                    f"Inconsistent number of frequency points on line {i + 1}. "
                    f"Expected {num_freq_points}, found {current_freq_points}."
                )

            # Update parameter ranges
            for key, value in data['params'].items():
                if not isinstance(value, (int, float)):
                    raise ValueError(f"Parameter '{key}' has non-numeric value on line {i + 1}.")
                if key not in param_ranges:
                    param_ranges[key] = {'min': value, 'max': value}
                else:
                    param_ranges[key]['min'] = min(param_ranges[key]['min'], value)
                    param_ranges[key]['max'] = max(param_ranges[key]['max'], value)

            # Check s11 values and update s11 range
            for s11_point in data['s11']:
                if not isinstance(s11_point, dict) or 'real' not in s11_point or 'imag' not in s11_point:
                     raise ValueError(f"Invalid s11 point format on line {i + 1}. Expected {{'real': ..., 'imag': ...}}.")
                
                real, imag = s11_point['real'], s11_point['imag']
                if not all(math.isfinite(v) for v in [real, imag]):
                    raise ValueError(f"Non-finite s11 value found on line {i + 1}: real={real}, imag={imag}")

                magnitude = math.sqrt(real**2 + imag**2)
                if magnitude > 0:
                    s11_db = 20 * math.log10(magnitude)
                else:
                    s11_db = float('-inf')
                
                s11_min_db = min(s11_min_db, s11_db)
                s11_max_db = max(s11_max_db, s11_db)

            num_samples += 1

    if num_samples == 0:
        raise ValueError("Dataset is empty or contains no valid records.")

    return {
        "num_samples": num_samples,
        "num_freq_points": num_freq_points,
        "param_ranges": param_ranges,
        "s11_range_db": (s11_min_db, s11_max_db),
    }
