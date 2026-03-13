import pytest
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from pathlib import Path

from antenna_ml.training.trainer import Trainer

# --- Fixtures ---

@pytest.fixture
def dummy_model():
    """A simple linear model for testing."""
    return nn.Sequential(nn.Linear(10, 5), nn.ReLU(), nn.Linear(5, 2))

@pytest.fixture
def dummy_dataset():
    """A dummy dataset with 100 samples."""
    inputs = torch.randn(100, 10)
    targets = torch.randn(100, 2)
    return TensorDataset(inputs, targets)

@pytest.fixture
def dummy_dataloaders(dummy_dataset):
    """Dummy train and validation dataloaders."""
    train_loader = DataLoader(dummy_dataset, batch_size=16)
    val_loader = DataLoader(dummy_dataset, batch_size=16)
    return train_loader, val_loader

# --- Tests ---

def test_trainer_initialization(dummy_model, dummy_dataloaders, tmp_path):
    """Tests if the Trainer class can be initialized correctly."""
    model = dummy_model
    train_loader, val_loader = dummy_dataloaders
    optimizer = torch.optim.Adam(model.parameters())
    loss_fn = nn.MSELoss()
    checkpoint_path = tmp_path / "test.pth"

    trainer = Trainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        optimizer=optimizer,
        loss_fn=loss_fn,
        device="cpu",
        checkpoint_path=str(checkpoint_path),
    )
    assert trainer.model is model
    assert trainer.best_val_loss == float('inf')

def test_trainer_train_run(dummy_model, dummy_dataloaders, tmp_path):
    """Tests if the train method runs and creates a checkpoint."""
    model = dummy_model
    train_loader, val_loader = dummy_dataloaders
    optimizer = torch.optim.Adam(model.parameters())
    loss_fn = nn.MSELoss()
    checkpoint_path = tmp_path / "test.pth"

    trainer = Trainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        optimizer=optimizer,
        loss_fn=loss_fn,
        device="cpu",
        checkpoint_path=str(checkpoint_path),
    )

    training_artifacts = {"test_key": "test_value"}
    trainer.train(epochs=2, training_artifacts=training_artifacts)

    # Check that history was recorded
    assert len(trainer.history["train_loss"]) == 2
    assert len(trainer.history["val_loss"]) == 2

    # Check that a checkpoint file was created
    assert checkpoint_path.exists()

    # Check checkpoint content
    checkpoint = torch.load(checkpoint_path)
    assert "model_state_dict" in checkpoint
    assert "optimizer_state_dict" in checkpoint
    assert "epoch" in checkpoint
    assert "best_val_loss" in checkpoint
    assert "history" in checkpoint
    assert "test_key" in checkpoint
    assert checkpoint["test_key"] == "test_value"

def test_trainer_saves_best_model(tmp_path):
    """Tests that the trainer correctly saves the model with the best validation loss."""

    class MockModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.layer = nn.Linear(1, 1)
            self.layer.weight.data.fill_(1.0)
            self.layer.bias.data.fill_(0.0)
        def forward(self, x):
            return self.layer(x)

    model = MockModel()

    # Create a dataset where loss will decrease then increase
    inputs = torch.tensor([[1.0], [2.0], [3.0], [4.0]]).float()
    targets1 = torch.tensor([[1.0], [2.0], [3.0], [4.0]]).float() # Low loss
    targets2 = torch.tensor([[10.0], [20.0], [30.0], [40.0]]).float() # High loss

    dataset1 = TensorDataset(inputs, targets1)
    dataset2 = TensorDataset(inputs, targets2)

    val_loader1 = DataLoader(dataset1, batch_size=2)
    val_loader2 = DataLoader(dataset2, batch_size=2)
    train_loader = DataLoader(dataset1, batch_size=2)

    optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
    loss_fn = nn.MSELoss()
    checkpoint_path = tmp_path / "best_model.pth"

    trainer = Trainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader1,  # Start with low loss val set
        optimizer=optimizer,
        loss_fn=loss_fn,
        device="cpu",
        checkpoint_path=str(checkpoint_path),
    )

    # Epoch 1: Train and validate with low-loss data. This should be the best model.
    trainer.train(epochs=1, training_artifacts={})
    assert checkpoint_path.exists()
    checkpoint1 = torch.load(checkpoint_path)
    model_state_epoch1 = checkpoint1['model_state_dict']

    # Epoch 2: Switch to high-loss validation set. This should not overwrite the checkpoint.
    trainer.val_loader = val_loader2
    trainer.train(epochs=1, training_artifacts={})
    checkpoint2 = torch.load(checkpoint_path)

    # The saved model state should still be from epoch 1
    assert torch.equal(model_state_epoch1['layer.weight'], checkpoint2['model_state_dict']['layer.weight'])
    assert checkpoint2['epoch'] == 0  # Epoch is 0-indexed
    assert checkpoint2['best_val_loss'] < 1.0  # Loss from the first epoch
