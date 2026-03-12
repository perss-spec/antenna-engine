"""
Training script for the surrogate antenna model.
This script generates synthetic data, defines a model, and runs a training loop.
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from pathlib import Path
import logging

from models.surrogate import SurrogateAntennaModel
from training.data_generator import generate_synthetic_data

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
NUM_SAMPLES = 5000
VALIDATION_SPLIT = 0.2
BATCH_SIZE = 64
EPOCHS = 100
LEARNING_RATE = 0.001
SEED = 42
MODEL_SAVE_PATH = Path("models/surrogate_model.pth")

def train_model():
    """
    Main function to orchestrate the model training process.
    """
    logging.info("Starting model training process...")

    # Ensure the model directory exists
    MODEL_SAVE_PATH.parent.mkdir(exist_ok=True)

    # 1. Generate Data
    logging.info(f"Generating {NUM_SAMPLES} synthetic data points...")
    X, y = generate_synthetic_data(num_samples=NUM_SAMPLES, seed=SEED)
    
    # Convert to PyTorch Tensors
    X_tensor = torch.from_numpy(X)
    y_tensor = torch.from_numpy(y)

    # 2. Create Datasets and DataLoaders
    dataset = TensorDataset(X_tensor, y_tensor)
    
    val_size = int(NUM_SAMPLES * VALIDATION_SPLIT)
    train_size = NUM_SAMPLES - val_size
    
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE)
    logging.info(f"Data loaded. Training set size: {len(train_dataset)}, Validation set size: {len(val_dataset)}")

    # 3. Initialize Model, Loss, and Optimizer
    model = SurrogateAntennaModel(input_size=3, output_size=1)
    loss_fn = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    logging.info(f"Model initialized. Starting training for {EPOCHS} epochs.")

    # 4. Training Loop
    best_val_loss = float('inf')
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = loss_fn(outputs, targets)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * inputs.size(0)

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                outputs = model(inputs)
                loss = loss_fn(outputs, targets)
                val_loss += loss.item() * inputs.size(0)

        train_loss /= len(train_loader.dataset)
        val_loss /= len(val_loader.dataset)
        
        if (epoch + 1) % 10 == 0:
            logging.info(f"Epoch {epoch+1}/{EPOCHS}, Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")

        # Save the model if validation loss has improved
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), MODEL_SAVE_PATH)
            logging.debug(f"Model saved at epoch {epoch+1} with validation loss {val_loss:.4f}")

    logging.info("Training complete.")
    logging.info(f"Best validation loss: {best_val_loss:.4f}")
    logging.info(f"Trained model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train_model()
