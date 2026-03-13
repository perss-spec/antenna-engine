import sys
import json
from pathlib import Path
from typing import List, Dict

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

# Add the 'python' directory to the path to allow direct imports from 'data', 'models', etc.
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from antenna_ml.data.dataset import AntennaS11Dataset
from antenna_ml.data.normalization import MinMaxNormalizer
from models.surrogate import SurrogateMLP
from antenna_ml.training.trainer import Trainer

# --- Configuration ---
DATA_PATH = project_root / "data/generated/dipole_10k.jsonl"
CHECKPOINT_PATH = project_root / "models/checkpoints/surrogate_v1.pth"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Training Hyperparameters
EPOCHS = 50
BATCH_SIZE = 64
LEARNING_RATE = 1e-4
VALIDATION_SPLIT = 0.15

def load_params_for_normalization(data_path: Path) -> List[Dict[str, float]]:
    """Loads only the 'params' part of the dataset for fitting the normalizer."""
    params_list = []
    with open(data_path, "r") as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                params_list.append(data['params'])
    return params_list

def main():
    """Main function to run the model training process."""
    print("--- Starting Model Training ---")
    print(f"Using device: {DEVICE}")

    if not DATA_PATH.exists():
        print(f"\nERROR: Dataset not found at {DATA_PATH}.\n" +
              "Please run 'python python/scripts/generate_dataset.py' first.")
        sys.exit(1)

    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # 1. Prepare Normalizer
    print(f"Loading parameters from {DATA_PATH} to fit normalizer...")
    params_list = load_params_for_normalization(DATA_PATH)
    normalizer = MinMaxNormalizer()
    normalizer.fit(params_list)
    print("Normalizer fitted.")

    # 2. Create Datasets and DataLoaders
    full_dataset = AntennaS11Dataset(data_path=str(DATA_PATH), normalizer=normalizer)

    val_size = int(len(full_dataset) * VALIDATION_SPLIT)
    train_size = len(full_dataset) - val_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    print(f"Dataset loaded: {len(full_dataset)} samples")
    print(f"  - Training set:   {len(train_dataset)} samples")
    print(f"  - Validation set: {len(val_dataset)} samples")

    # 3. Initialize Model and Training Components
    sample_input, sample_output = full_dataset[0]
    model_config = {
        "input_dim": sample_input.shape[0],
        "output_dim": sample_output.shape[0],
        "hidden_dim": 256,  # From architecture guidelines
        "n_hidden_layers": 3,  # From architecture guidelines
    }
    model = SurrogateMLP(**model_config).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.MSELoss()

    # 4. Create and run Trainer
    trainer = Trainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        optimizer=optimizer,
        loss_fn=loss_fn,
        device=DEVICE,
        checkpoint_path=str(CHECKPOINT_PATH),
    )

    # Artifacts to save with the model checkpoint
    training_artifacts = {
        'model_config': model_config,
        'normalizer_state': {
            'param_keys': normalizer.param_keys,
            'min_vals': normalizer.min_vals,
            'max_vals': normalizer.max_vals,
        },
    }

    trainer.train(epochs=EPOCHS, training_artifacts=training_artifacts)

    print("\n--- Training Complete ---")
    print(f"Best model saved to {CHECKPOINT_PATH}")
    print("To export this model to ONNX, run: python python/scripts/export_onnx.py")

if __name__ == "__main__":
    main()
