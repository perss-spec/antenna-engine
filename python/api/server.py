import os
from typing import List, Optional, Dict
import logging

import torch
import numpy as np
from pydantic import BaseModel, Field
from scipy.interpolate import interp1d

# This implementation assumes `fastapi` is an available dependency for this task.
from fastapi import FastAPI, HTTPException

from models.surrogate import SurrogateMLP
from antenna_ml.data.normalization import MinMaxNormalizer

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
MODEL_PATH = os.getenv("MODEL_PATH", "runs/s11_surrogate/best_model.pth")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# --- Global State ---
app = FastAPI(
    title="PROMIN Antenna Studio ML API",
    description="Inference server for antenna surrogate models.",
    version="0.1.0",
)

model: Optional[SurrogateMLP] = None
normalizer: Optional[MinMaxNormalizer] = None
model_metadata: Dict = {}

# --- Pydantic Models ---
class PredictionRequest(BaseModel):
    params: Dict[str, float] = Field(
        ...,
        description="Dictionary of antenna parameters (e.g., {'length': 0.1, 'radius': 0.002}).",
        examples=[{"length": 0.1, "radius": 0.002}]
    )
    freq_start_hz: float = Field(..., gt=0, description="Start frequency for prediction in Hz.", examples=[1e9])
    freq_stop_hz: float = Field(..., gt=0, description="Stop frequency for prediction in Hz.", examples=[4e9])
    num_points: int = Field(..., gt=1, description="Number of frequency points to return.", examples=[201])

class PredictionResponse(BaseModel):
    frequencies_hz: List[float] = Field(..., description="List of frequency points in Hz.")
    s11_db: List[float] = Field(..., description="Predicted S11 values in dB at each frequency.")

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_path: str
    model_params: Optional[List[str]] = None

# --- Model Loading --- 
@app.on_event("startup")
def load_model():
    global model, normalizer, model_metadata
    try:
        if not os.path.exists(MODEL_PATH):
            logging.warning(f"Model file not found at {MODEL_PATH}. Server will start without a model.")
            return

        logging.info(f"Loading model from {MODEL_PATH} onto {DEVICE}...")
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)

        model_config = checkpoint['model_config']
        model = SurrogateMLP(**model_config)
        model.load_state_dict(checkpoint['model_state_dict'])
        model.to(DEVICE)
        model.eval()

        normalizer_state = checkpoint['normalizer_state']
        normalizer = MinMaxNormalizer()
        normalizer.min_vals = normalizer_state['min_vals']
        normalizer.max_vals = normalizer_state['max_vals']
        normalizer.param_keys = normalizer_state['param_keys']
        
        model_metadata['native_num_freq_points'] = model_config['output_dim'] // 2
        if 'freq_range' in checkpoint:
            model_metadata['native_freq_range_hz'] = checkpoint['freq_range']
        else:
            logging.warning("Frequency range not in model artifact. Falling back to default [1e9, 4e9] Hz.")
            model_metadata['native_freq_range_hz'] = [1e9, 4e9]

        logging.info("Model and normalizer loaded successfully.")

    except Exception as e:
        logging.error(f"Failed to load model: {e}", exc_info=True)
        model = None
        normalizer = None

# --- API Endpoints ---
@app.get("/health", response_model=HealthResponse)
def health_check():
    """Checks the health of the server and reports model status."""
    return HealthResponse(
        status="ok",
        model_loaded=model is not None,
        model_path=MODEL_PATH,
        model_params=normalizer.param_keys if normalizer else None
    )

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    """Predicts the S11 curve for a given set of antenna parameters."""
    if not model or not normalizer:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    if sorted(request.params.keys()) != sorted(normalizer.param_keys):
        raise HTTPException(status_code=400, detail=f"Invalid parameters. Model expects: {normalizer.param_keys}")

    try:
        normalized_input = normalizer.transform(request.params)
        input_tensor = torch.from_numpy(normalized_input).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            output_tensor = model(input_tensor)
        
        output_np = output_tensor.squeeze(0).cpu().numpy()

    except Exception as e:
        logging.error(f"Inference failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error during model inference.")

    native_num_points = model_metadata['native_num_freq_points']
    real_parts = output_np[0::2]
    imag_parts = output_np[1::2]

    native_freqs = np.linspace(*model_metadata['native_freq_range_hz'], native_num_points)
    requested_freqs = np.linspace(request.freq_start_hz, request.freq_stop_hz, request.num_points)

    interp_real = interp1d(native_freqs, real_parts, kind='cubic', bounds_error=False, fill_value='extrapolate')
    interp_imag = interp1d(native_freqs, imag_parts, kind='cubic', bounds_error=False, fill_value='extrapolate')

    resampled_real = interp_real(requested_freqs)
    resampled_imag = interp_imag(requested_freqs)

    resampled_complex = resampled_real + 1j * resampled_imag
    resampled_s11_db = 20 * np.log10(np.abs(resampled_complex))

    return PredictionResponse(
        frequencies_hz=requested_freqs.tolist(),
        s11_db=resampled_s11_db.tolist()
    )
