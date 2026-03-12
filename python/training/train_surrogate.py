import argparse
import json
from pathlib import Path
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

# Local project imports
from antenna_ml.models.surrogate_s11 import S11SurrogateModel
from antenna_ml.data.generator import run_mock_solver, DipoleParameters
from antenna_ml.data.dataset import AntennaS11Dataset
from antenna_ml.data.normalization import MinMaxNormalizer

# --- Configuration ---
# Data Generation
NUM_SIMULATIONS = 500  # As per architecture doc (200-500)
PARAM_RANGES = {
    "length": (0.05, 0.15),  # meters, for frequencies around 1-3 GHz
    "radius": (0.001, 0.005), # meters
}
FREQ_RANGE = (1e9, 4e9)  # 1-4 GHz
NUM_FREQ_POINTS = 101

# Training
EPOCHS = 100 # As per architecture doc (100-500)
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
VALIDATION_SPLIT = 0.2
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# File Paths
DATA_DIR = Path("data/generated")
RUNS_DIR = Path("runs/s11_surrogate")


def prepare_data(dataset_path: Path):
    """Generates simulation data if the dataset file doesn't exist."""
    if dataset_path.exists():
        print(f"Dataset found at {dataset_path}, skipping generation.")
        return

    print(f"Generating {NUM_SIMULATIONS} simulation results...")
    dataset_path.parent.mkdir(parents=True, exist_ok=True)

    with open(dataset_path, "w") as f:
        freq_points = torch.linspace(FREQ_RANGE[0], FREQ_RANGE[1], NUM_FREQ_POINTS).numpy()
        for i in range(NUM_SIMULATIONS):
            params = {
                key: torch.rand(1).item() * (v_max - v_min) + v_min
                for key, (v_min, v_max) in PARAM_RANGES.items()
            }
            dipole_params = DipoleParameters(**params)

            sim_output = run_mock_solver(dipole_params, freq_points)

            # The s11 from run_mock_solver is List[Tuple[float, float]].
            # The SimulationResult model (used by AntennaS11Dataset) expects a list of
            # Pydantic ComplexNumber models, which serialize to {"real": r, "imag": i}.
            s11_for_json = [{"real": r, "imag": i} for r, i in sim_output.s11]

            record = {
                "params": sim_output.params.model_dump(),
                "s11": s11_for_json,
                "far_field": sim_output.far_field,
            }

            f.write(json.dumps(record) + "\n")
            if (i + 1) % 50 == 0:
                print(f"  ...generated {i+1}/{NUM_SIMULATIONS} samples.")

def fit_normalizer(dataset_path: Path) -> MinMaxNormalizer:
    """Fits a MinMaxNormalizer on the parameters from a dataset file."""
    params_list = []
    with open(dataset_path, "r") as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                params_list.append(data["params"])
    
    normalizer = MinMaxNormalizer()
    normalizer.fit(params_list)
    return normalizer


def main():
    """Main training script."""
    parser = argparse.ArgumentParser(description="Train S11 Surrogate Model")
    parser.add_argument(
        "--run_name", type=str, default=f"run_{torch.randint(1000, 9999, (1,)).item()}",
        help="A name for this training run."
    )
    args = parser.parse_args()

    # 1. Setup paths
    run_dir = RUNS_DIR / args.run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    dataset_path = DATA_DIR / "dipole_s11_dataset.jsonl"
    print(f"Starting training run: {args.run_name}")
    print(f"Using device: {DEVICE}")
    print(f"Output will be saved to: {run_dir}")

    # 2. Generate data
    prepare_data(dataset_path)

    # 3. Prepare Normalizer and Datasets
    print("Preparing data normalizer and datasets...")
    normalizer = fit_normalizer(dataset_path)
    
    full_dataset = AntennaS11Dataset(data_path=str(dataset_path), normalizer=normalizer)

    val_size = int(len(full_dataset) * VALIDATION_SPLIT)
    train_size = len(full_dataset) - val_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE)

    print(f"Training set size: {len(train_dataset)}")
    print(f"Validation set size: {len(val_dataset)}")

    # 4. Initialize Model, Loss, and Optimizer
    input_dim = len(normalizer.param_keys)
    _, sample_target = full_dataset[0]
    output_dim = sample_target.shape[0]

    model = S11SurrogateModel(input_dim=input_dim, output_dim=output_dim).to(DEVICE)
    loss_fn = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    print("\nModel Architecture:")
    print(model)
    print(f"Input dim: {input_dim}, Output dim: {output_dim}\n")

    # 5. Training Loop
    print("Starting training...")
    best_val_loss = float('inf')
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

        train_loss /= len(train_loader)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)
                outputs = model(inputs)
                loss = loss_fn(outputs, targets)
                val_loss += loss.item()
        
        val_loss /= len(val_loader)

        print(f"Epoch [{epoch+1:03d}/{EPOCHS}], Train Loss: {train_loss:.6f}, Val Loss: {val_loss:.6f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), run_dir / "best_model.pth")
            print(f"  -> New best model saved with validation loss: {val_loss:.6f}")

    # 6. Save final artifacts
    print("\nTraining finished. Saving final artifacts.")
    
    normalizer_state = {
        "param_keys": normalizer.param_keys,
        "min_vals": normalizer.min_vals,
        "max_vals": normalizer.max_vals,
    }
    with open(run_dir / "normalizer.json", "w") as f:
        json.dump(normalizer_state, f, indent=2)

    print("Exporting best model to ONNX...")
    best_model = S11SurrogateModel(input_dim=input_dim, output_dim=output_dim)
    best_model.load_state_dict(torch.load(run_dir / "best_model.pth"))
    best_model.to(DEVICE)
    best_model.export_onnx(str(run_dir / "surrogate_s11.onnx"))

    print(f"\nArtifacts saved in {run_dir}")
    print(f" - Best PyTorch model: {run_dir / 'best_model.pth'}")
    print(f" - Normalizer config: {run_dir / 'normalizer.json'}")
    print(f" - ONNX model: {run_dir / 'surrogate_s11.onnx'}")


if __name__ == "__main__":
    main()
