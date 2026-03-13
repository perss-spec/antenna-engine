import sys
from pathlib import Path

# Add the 'python' directory to the path to allow direct imports from 'data', 'models', etc.
# This is necessary for running the script directly from the command line.
# __file__ is python/scripts/generate_dataset.py
# .parents[0] is python/scripts
# .parents[1] is python
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from data.generator import generate_s11_dataset

# --- Configuration ---
NUM_SIMULATIONS = 10000
OUTPUT_FILE = project_root / "data/generated/dipole_10k.jsonl"
PARAM_RANGES = {
    "length": (0.05, 0.3),      # meters
    "radius": (0.0005, 0.005),  # meters
}
FREQ_RANGE = (0.5e9, 6.0e9)     # 0.5 GHz to 6 GHz
NUM_FREQ_POINTS = 101

def main():
    """Main function to run the dataset generation process."""
    print("--- Starting Dataset Generation ---")
    print(f"Number of samples: {NUM_SIMULATIONS}")
    print(f"Output file: {OUTPUT_FILE}")

    # The imported generator function handles directory creation and progress printing.
    generate_s11_dataset(
        num_simulations=NUM_SIMULATIONS,
        output_path=OUTPUT_FILE,
        param_ranges=PARAM_RANGES,
        freq_range=FREQ_RANGE,
        num_freq_points=NUM_FREQ_POINTS,
    )

    print("\n--- Dataset Generation Finished ---")

if __name__ == "__main__":
    main()
