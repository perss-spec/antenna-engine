from typing import Dict, Optional
from .types import Material

DEFAULT_MATERIALS: Dict[str, Material] = {
    "PEC": Material(
        name="Perfect Electric Conductor",
        epsilon_r=1.0,
        mu_r=1.0,
        sigma=1e10,
        tan_delta=0.0
    ),
    "Copper": Material(
        name="Copper",
        epsilon_r=1.0,
        mu_r=1.0,
        sigma=5.96e7,
        tan_delta=0.0
    ),
    "FR4": Material(
        name="FR4 Substrate",
        epsilon_r=4.4,
        mu_r=1.0,
        sigma=0.0,
        tan_delta=0.02
    ),
    "Air": Material(
        name="Air",
        epsilon_r=1.0,
        mu_r=1.0,
        sigma=0.0,
        tan_delta=0.0
    ),
    "RT5880": Material(
        name="Rogers RT/duroid 5880",
        epsilon_r=2.2,
        mu_r=1.0,
        sigma=0.0,
        tan_delta=0.0009
    )
}

class MaterialDatabase:
    def __init__(self, materials: Optional[Dict[str, Material]] = None):
        self.materials = materials or DEFAULT_MATERIALS.copy()
    
    def get_material(self, name: str) -> Optional[Material]:
        return self.materials.get(name)
    
    def add_material(self, material: Material) -> None:
        self.materials[material.name] = material
    
    def list_materials(self) -> list[str]:
        return list(self.materials.keys())
    
    def get_all_materials(self) -> Dict[str, Material]:
        return self.materials.copy()