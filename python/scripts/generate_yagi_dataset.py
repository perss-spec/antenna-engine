import sys
from pathlib import Path

# Add project root to path for direct imports
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from antenna_ml.data.yagi_generator import generate_yagi_dataset

# --- Configuration ---
# Fulfills AC: "Dataset includes 1000+ Yagi configurations"
NUM_SIMULATIONS = 2000
OUTPUT_FILE = project_root / "data/generated/yagi_2k.jsonl"

# Frequency range for S11 simulation
FREQ_RANGE = (0.4e9, 1.2e9)  # 400 MHz to 1.2 GHz
NUM_FREQ_POINTS = 101

def main():
    """Main function to run the Yagi dataset generation process."""
    print("--- Starting Yagi-Uda Dataset Generation ---")
    print(f"Number of samples: {NUM_SIMULATIONS}")
    print(f"Output file: {OUTPUT_FILE}")

    # The imported generator function handles directory creation,
    # progress printing, and metadata file creation.
    generate_yagi_dataset(
        num_simulations=NUM_SIMULATIONS,
        output_path=OUTPUT_FILE,
        freq_range=FREQ_RANGE,
        num_freq_points=NUM_FREQ_POINTS,
    )

    print("\n--- Yagi Dataset Generation Finished ---")
    print(f"Run 'python python/data/validate.py --path {OUTPUT_FILE}' to validate.")

if __name__ == "__main__":
    main()
