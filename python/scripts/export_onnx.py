import sys
from pathlib import Path
import torch

# Add the 'python' directory to the path to allow direct imports from 'models', etc.
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from models.surrogate import SurrogateMLP

# --- Configuration ---
CHECKPOINT_PATH = project_root / "models/checkpoints/surrogate_v1.pth"
ONNX_EXPORT_PATH = project_root / "models/exports/surrogate_v1.onnx"
DEVICE = "cpu"  # Exporting should be done on CPU for consistency

# --- Default model config if checkpoint is not found ---
# This should match the configuration used in scripts/train_model.py
DEFAULT_MODEL_CONFIG = {
    "input_dim": 2,      # For dipole: length, radius
    "output_dim": 202,   # For 101 frequency points, real+imag interleaved
    "hidden_dim": 256,
    "n_hidden_layers": 3,
}

def main():
    """
    Loads a trained PyTorch model checkpoint and exports it to the ONNX format.
    If the checkpoint does not exist, a randomly initialized model with a
    default configuration is exported instead.
    """
    print("--- Starting ONNX Export ---")

    # Ensure the export directory exists
    ONNX_EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    model_config = DEFAULT_MODEL_CONFIG

    if CHECKPOINT_PATH.exists():
        print(f"Loading trained model from: {CHECKPOINT_PATH}")
        try:
            checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE)

            # The training script saves 'model_config'
            if 'model_config' in checkpoint:
                model_config = checkpoint['model_config']
                print(f"Loaded model configuration: {model_config}")
            else:
                print("Warning: 'model_config' not found in checkpoint. Using default config.")

            model = SurrogateMLP(**model_config)
            model.load_state_dict(checkpoint['model_state_dict'])
            print("Trained model weights loaded successfully.")
        except Exception as e:
            print(f"Error loading checkpoint: {e}. Aborting.")
            sys.exit(1)
    else:
        print(f"Warning: Checkpoint not found at {CHECKPOINT_PATH}.")
        print("Creating and exporting a randomly initialized model with default configuration.")
        print(f"Default config: {model_config}")
        model = SurrogateMLP(**model_config)

    model.to(DEVICE)
    model.eval()

    # The export_onnx method is defined on the SurrogateMLP class
    try:
        # The method handles dynamic axes and input/output names
        model.export_onnx(str(ONNX_EXPORT_PATH))
        print(f"\nModel successfully exported to: {ONNX_EXPORT_PATH}")
        print("Export complete. The model is ready for use with ONNX Runtime.")
    except Exception as e:
        print(f"\nAn error occurred during ONNX export: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
