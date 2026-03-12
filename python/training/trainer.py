import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from typing import Dict, Any

from models.surrogate import SurrogateAntennaModel as SurrogateMLP

def train_model(
    model: SurrogateMLP,
    dataset: Dataset,
    epochs: int = 10,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    device: str = "cpu"
) -> Dict[str, Any]:
    """
    A basic training loop for the surrogate model.

    Args:
        model (SurrogateMLP): The model to train.
        dataset (Dataset): The training dataset.
        epochs (int): Number of training epochs.
        batch_size (int): Batch size for training.
        learning_rate (float): Learning rate for the optimizer.
        device (str): The device to train on ('cpu' or 'cuda').

    Returns:
        Dict[str, Any]: A dictionary containing the trained model and training history.
    """
    model.to(device)
    model.train()

    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    loss_fn = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    loss_history = []

    print(f"Starting training for {epochs} epochs on {device}...")
    for epoch in range(epochs):
        epoch_loss = 0.0
        for inputs, targets in dataloader:
            inputs, targets = inputs.to(device), targets.to(device)

            # Forward pass
            outputs = model(inputs)
            loss = loss_fn(outputs, targets)

            # Backward and optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()

        avg_epoch_loss = epoch_loss / len(dataloader)
        loss_history.append(avg_epoch_loss)
        print(f"Epoch [{epoch+1}/{epochs}], Loss: {avg_epoch_loss:.6f}")

    print("Training finished.")

    return {
        "model_state_dict": model.state_dict(),
        "loss_history": loss_history,
    }
