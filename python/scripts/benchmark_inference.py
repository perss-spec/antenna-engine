import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

# Add the 'python' directory to the path to allow direct imports from 'models', etc.
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from models.surrogate import SurrogateMLP

# --- Configuration ---
CHECKPOINT_PATH = project_root / "models/checkpoints/surrogate_v1.pth"
ONNX_MODEL_PATH = project_root / "models/exports/surrogate_v1.onnx"
DEVICE = "cpu"  # Benchmarking on CPU for fair comparison with ONNX Runtime CPU
NUM_SAMPLES = 1000
WARMUP_RUNS = 100

# --- Default model config if checkpoint is not found ---
DEFAULT_MODEL_CONFIG = {
    "input_dim": 2,
    "output_dim": 202,
    "hidden_dim": 256,
    "n_hidden_layers": 3,
}

def load_pytorch_model() -> tuple[SurrogateMLP, int]:
    """Loads the PyTorch model from a checkpoint or creates a new one."""
    model_config = DEFAULT_MODEL_CONFIG
    if CHECKPOINT_PATH.exists():
        print(f"Loading PyTorch model from: {CHECKPOINT_PATH}")
        checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
        if 'model_config' in checkpoint:
            model_config = checkpoint['model_config']
        model = SurrogateMLP(**model_config)
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        print(f"Warning: PyTorch checkpoint not found. Using random model.")
        model = SurrogateMLP(**model_config)

    model.to(DEVICE)
    model.eval()
    return model, model_config['input_dim']

def main():
    """
    Compares the inference speed of a PyTorch model against its ONNX version.
    """
    print("--- Starting Inference Benchmark ---")
    print(f"Device: {DEVICE}")
    print(f"Number of samples: {NUM_SAMPLES}")

    # 1. Load PyTorch Model
    try:
        pytorch_model, input_dim = load_pytorch_model()
    except Exception as e:
        print(f"Error loading PyTorch model: {e}")
        sys.exit(1)

    # 2. Load ONNX Model
    if not ONNX_MODEL_PATH.exists():
        print(f"Error: ONNX model not found at {ONNX_MODEL_PATH}")
        print("Please run 'python python/scripts/export_onnx.py' first.")
        sys.exit(1)

    try:
        print(f"Loading ONNX model from: {ONNX_MODEL_PATH}")
        ort_session = ort.InferenceSession(str(ONNX_MODEL_PATH), providers=['CPUExecutionProvider'])
        input_name = ort_session.get_inputs()[0].name
    except Exception as e:
        print(f"Error loading ONNX model: {e}")
        sys.exit(1)

    # 3. Generate random input data
    print(f"Generating {NUM_SAMPLES} random input samples with dim={input_dim}...")
    random_inputs_torch = torch.randn(NUM_SAMPLES, input_dim, device=DEVICE)
    random_inputs_np = random_inputs_torch.cpu().numpy()

    # --- 4. Benchmark PyTorch ---
    print("\nBenchmarking PyTorch model...")
    with torch.no_grad():
        # Warm-up
        for i in range(WARMUP_RUNS):
            _ = pytorch_model(random_inputs_torch[i].unsqueeze(0))

        # Timed run (individual inferences to simulate online use)
        start_time_torch = time.perf_counter()
        for i in range(NUM_SAMPLES):
            _ = pytorch_model(random_inputs_torch[i].unsqueeze(0))
        end_time_torch = time.perf_counter()

    torch_duration = end_time_torch - start_time_torch
    torch_avg_ms = (torch_duration / NUM_SAMPLES) * 1000
    print(f"PyTorch total time: {torch_duration:.4f} seconds")
    print(f"PyTorch average inference: {torch_avg_ms:.4f} ms/sample")

    # --- 5. Benchmark ONNX Runtime ---
    print("\nBenchmarking ONNX Runtime model...")
    # Warm-up
    for i in range(WARMUP_RUNS):
        _ = ort_session.run(None, {input_name: random_inputs_np[i].reshape(1, -1)})

    # Timed run
    start_time_onnx = time.perf_counter()
    for i in range(NUM_SAMPLES):
        _ = ort_session.run(None, {input_name: random_inputs_np[i].reshape(1, -1)})
    end_time_onnx = time.perf_counter()

    onnx_duration = end_time_onnx - start_time_onnx
    onnx_avg_ms = (onnx_duration / NUM_SAMPLES) * 1000
    print(f"ONNX Runtime total time: {onnx_duration:.4f} seconds")
    print(f"ONNX Runtime average inference: {onnx_avg_ms:.4f} ms/sample")

    # --- 6. Report Results ---
    print("\n--- Benchmark Results ---")
    if onnx_duration > 1e-9:
        speedup = torch_duration / onnx_duration
        print(f"Speedup Factor (PyTorch / ONNX): {speedup:.2f}x")
        if speedup > 1:
            print("ONNX Runtime is faster.")
        else:
            print("PyTorch is faster or equivalent.")
    else:
        print("Could not calculate speedup factor (ONNX duration was near zero).")

if __name__ == "__main__":
    main()
