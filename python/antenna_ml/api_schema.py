from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Optional
from .types import (
    PredictionRequest, PredictionResponse, ModelMetadata,
    OptimizationParams, OptimizationResult, DatasetEntry
)

app = FastAPI(title="PROMIN Antenna ML API", version="1.0.0")

class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: int
    gpu_available: bool

class TrainingRequest(BaseModel):
    dataset_path: str
    model_config: Dict
    output_path: str
    validation_split: float = 0.2

class TrainingResponse(BaseModel):
    model_id: str
    training_time: float
    final_loss: float
    validation_accuracy: float
    onnx_path: str

class DatasetValidationRequest(BaseModel):
    dataset_path: str
    antenna_type: str

class DatasetValidationResponse(BaseModel):
    is_valid: bool
    num_samples: int
    parameter_ranges: Dict[str, tuple[float, float]]
    frequency_range: tuple[float, float]
    quality_score: float
    issues: List[str]

# API Endpoints Schema

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and loaded models"""
    pass

@app.get("/models", response_model=List[ModelMetadata])
async def list_models():
    """List all available trained models"""
    pass

@app.post("/predict", response_model=PredictionResponse)
async def predict_antenna(request: PredictionRequest):
    """Predict antenna performance using trained model"""
    pass

@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest):
    """Train new surrogate model on dataset"""
    pass

@app.post("/optimize", response_model=OptimizationResult)
async def optimize_antenna(params: OptimizationParams):
    """Optimize antenna parameters using surrogate model"""
    pass

@app.post("/validate_dataset", response_model=DatasetValidationResponse)
async def validate_dataset(request: DatasetValidationRequest):
    """Validate dataset quality and format"""
    pass

@app.post("/export_onnx")
async def export_model_onnx(model_id: str, output_path: str):
    """Export trained model to ONNX format"""
    pass