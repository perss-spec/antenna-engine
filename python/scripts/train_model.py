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

    # 3. Initialize Model
    sample_input, sample_output = full_dataset[0]
    model_config = {
        "input_dim": sample_input.shape[0],
        "output_dim": sample_output.shape[0],
        "hidden_dim": 256,  # From architecture guidelines
        "n_hidden_layers": 3, # From architecture guidelines
    }
    model = SurrogateMLP(**model_config).to(DEVICE)
    print(f"Model created with input_dim={model_config['input_dim']}, output_dim={model_config['output_dim']}")

    # 4. Training Loop
    loss_fn = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    best_val_loss = float('inf')

    print("\nStarting training...")
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = loss_fn(outputs, targets)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        avg_train_loss = train_loss / len(train_loader)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)
                outputs = model(inputs)
                loss = loss_fn(outputs, targets)
                val_loss += loss.item()
        avg_val_loss = val_loss / len(val_loader)
        
        print(f"Epoch [{epoch+1:02d}/{EPOCHS}], Train Loss: {avg_train_loss:.6f}, Val Loss: {avg_val_loss:.6f}", end="")

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            print(" -> New best, saving checkpoint...")
            CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
            checkpoint = {
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "model_config": model_config,
                "normalizer_state": {
                    "min_vals": normalizer.min_vals,
                    "max_vals": normalizer.max_vals,
                    "param_keys": normalizer.param_keys,
                },
            }
            torch.save(checkpoint, CHECKPOINT_PATH)
        else:
            print()

    print("\n--- Training Finished ---")
    print(f"Best model checkpoint saved to: {CHECKPOINT_PATH}")

if __name__ == "__main__":
    main()
