import time
from typing import Dict, Any

import torch
import torch.nn as nn
from torch.utils.data import DataLoader


class Trainer:
    """
    A class to encapsulate the training and validation loop for a PyTorch model,
    handling checkpointing of the best model based on validation loss.
    """

    def __init__(
        self,
        model: nn.Module,
        train_loader: DataLoader,
        val_loader: DataLoader,
        optimizer: torch.optim.Optimizer,
        loss_fn: nn.Module,
        device: str,
        checkpoint_path: str,
    ):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.optimizer = optimizer
        self.loss_fn = loss_fn
        self.device = device
        self.checkpoint_path = checkpoint_path
        self.best_val_loss = float('inf')
        self.history = {"train_loss": [], "val_loss": []}

    def _train_epoch(self) -> float:
        """Runs one epoch of training."""
        self.model.train()
        total_loss = 0.0
        for inputs, targets in self.train_loader:
            inputs, targets = inputs.to(self.device), targets.to(self.device)

            self.optimizer.zero_grad()
            outputs = self.model(inputs)
            loss = self.loss_fn(outputs, targets)
            loss.backward()
            self.optimizer.step()

            total_loss += loss.item()

        return total_loss / len(self.train_loader)

    def _validate_epoch(self) -> float:
        """Runs one epoch of validation."""
        self.model.eval()
        total_loss = 0.0
        with torch.no_grad():
            for inputs, targets in self.val_loader:
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                outputs = self.model(inputs)
                loss = self.loss_fn(outputs, targets)
                total_loss += loss.item()

        return total_loss / len(self.val_loader)

    def train(self, epochs: int, training_artifacts: Dict[str, Any]):
        """
        Runs the full training process for a specified number of epochs.

        Args:
            epochs: The number of epochs to train for.
            training_artifacts: A dictionary containing additional artifacts to save
                                with the checkpoint (e.g., normalizer state, model config).
        """
        print(f"Starting training for {epochs} epochs on {self.device}...")
        start_time = time.time()

        for epoch in range(epochs):
            train_loss = self._train_epoch()
            val_loss = self._validate_epoch()

            self.history["train_loss"].append(train_loss)
            self.history["val_loss"].append(val_loss)

            print(f"Epoch [{epoch + 1}/{epochs}] | Train Loss: {train_loss:.6f} | Val Loss: {val_loss:.6f}")

            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                print(f"  -> New best validation loss. Saving model to {self.checkpoint_path}")
                checkpoint = {
                    'epoch': epoch + 1,
                    'model_state_dict': self.model.state_dict(),
                    'optimizer_state_dict': self.optimizer.state_dict(),
                    'best_val_loss': self.best_val_loss,
                    **training_artifacts,
                }
                torch.save(checkpoint, self.checkpoint_path)

        end_time = time.time()
        print(f"\nTraining finished in {end_time - start_time:.2f} seconds.")
        print(f"Best validation loss: {self.best_val_loss:.6f}")
        print(f"Model checkpoint saved at: {self.checkpoint_path}")
