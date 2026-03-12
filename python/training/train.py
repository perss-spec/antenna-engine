import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
import json
import logging
from pathlib import Path
from typing import Dict, List, Any

# Assuming python path is configured to see antenna_ml and models
from antenna_ml.data.dataset import AntennaS11Dataset
from antenna_ml.data.normalization import MinMaxNormalizer
from models.surrogate import SurrogateMLP

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def train_surrogate(
    data_path: str,
    model_path: str, # Full path to the output .pth file
    epochs: int = 100,
    batch_size: int = 64,
    lr: float = 1e-3,
    validation_split: float = 0.2,
    hidden_dim: int = 256,
    n_hidden_layers: int = 3,
) -> Dict[str, Any]:
    """
    Trains a surrogate model on antenna simulation data, saves the best checkpoint,
    and returns training metrics.

    Args:
        data_path: Path to the JSONL dataset file.
        model_path: Full path to save the best model checkpoint (.pth).
        epochs: Number of training epochs.
        batch_size: Batch size for training.
        lr: Learning rate for the Adam optimizer.
        validation_split: Fraction of data to use for validation.
        hidden_dim: Number of units in hidden layers.
        n_hidden_layers: Number of hidden layers.

    Returns:
        A dictionary containing training history.
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logging.info(f"Using device: {device}")

    model_save_path = Path(model_path)
    model_save_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Prepare data and normalizer by pre-scanning the dataset
    logging.info("Preparing data and fitting normalizer...")
    params_list = []
    output_dim = 0
    freq_info = {}

    with open(data_path, "r") as f:
        for i, line in enumerate(f):
            if line.strip():
                data = json.loads(line)
                params_list.append(data["params"])
                if i == 0:
                    output_dim = len(data["s11"]) * 2
                    # The data generator script from the prompt does not save frequency info.
                    # This is a placeholder for a more robust data pipeline.
                    if "freq_range" in data and "num_freq_points" in data:
                         freq_info = {
                             "freq_range": data["freq_range"],
                             "num_freq_points": data["num_freq_points"]
                         }

    if not params_list:
        raise ValueError("Dataset is empty or could not be read.")

    normalizer = MinMaxNormalizer()
    normalizer.fit(params_list)
    input_dim = len(normalizer.param_keys)

    # 2. Create Datasets and DataLoaders
    full_dataset = AntennaS11Dataset(data_path=data_path, normalizer=normalizer)
    
    val_size = int(len(full_dataset) * validation_split)
    train_size = len(full_dataset) - val_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)
    logging.info(f"Data loaded. Train size: {train_size}, Val size: {val_size}")

    # 3. Initialize Model, Loss, and Optimizer
    model = SurrogateMLP(
        input_dim=input_dim,
        output_dim=output_dim,
        hidden_dim=hidden_dim,
        n_hidden_layers=n_hidden_layers,
    ).to(device)
    
    loss_fn = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    # 4. Training Loop
    best_val_loss = float('inf')
    train_loss_history: List[float] = []
    val_loss_history: List[float] = []

    logging.info(f"Starting training for {epochs} epochs...")
    for epoch in range(epochs):
        model.train()
        running_train_loss = 0.0
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = loss_fn(outputs, targets)
            loss.backward()
            optimizer.step()
            running_train_loss += loss.item() * inputs.size(0)

        epoch_train_loss = running_train_loss / train_size
        train_loss_history.append(epoch_train_loss)

        # Validation
        model.eval()
        running_val_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                loss = loss_fn(outputs, targets)
                running_val_loss += loss.item() * inputs.size(0)
        
        epoch_val_loss = running_val_loss / val_size
        val_loss_history.append(epoch_val_loss)

        if (epoch + 1) % 10 == 0:
            logging.info(f"Epoch {epoch+1}/{epochs}, Train Loss: {epoch_train_loss:.6f}, Val Loss: {epoch_val_loss:.6f}")

        # Save best model checkpoint
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            
            checkpoint = {
                'model_state_dict': model.state_dict(),
                'normalizer_state': {
                    'min_vals': normalizer.min_vals,
                    'max_vals': normalizer.max_vals,
                    'param_keys': normalizer.param_keys,
                },
                'model_config': {
                    'input_dim': input_dim,
                    'output_dim': output_dim,
                    'hidden_dim': hidden_dim,
                    'n_hidden_layers': n_hidden_layers,
                },
                **freq_info
            }
            torch.save(checkpoint, model_save_path)
            logging.info(f"New best model saved at epoch {epoch+1} with val loss: {epoch_val_loss:.6f}")

    logging.info(f"Training finished. Best validation loss: {best_val_loss:.6f}")
    
    return {
        "train_loss": train_loss_history,
        "val_loss": val_loss_history,
        "epochs_trained": epochs,
    }
