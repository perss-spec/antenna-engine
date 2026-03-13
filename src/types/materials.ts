import { Material } from './antenna';

export interface MaterialDatabase {
  materials: Record<string, Material>;
}

export const DEFAULT_MATERIALS: Record<string, Material> = {
  PEC: {
    name: 'Perfect Electric Conductor',
    epsilonR: 1.0,
    muR: 1.0,
    sigma: 1e10,
    tanDelta: 0.0
  },
  Copper: {
    name: 'Copper',
    epsilonR: 1.0,
    muR: 1.0,
    sigma: 5.96e7,
    tanDelta: 0.0
  },
  FR4: {
    name: 'FR4 Substrate',
    epsilonR: 4.4,
    muR: 1.0,
    sigma: 0.0,
    tanDelta: 0.02
  },
  Air: {
    name: 'Air',
    epsilonR: 1.0,
    muR: 1.0,
    sigma: 0.0,
    tanDelta: 0.0
  },
  RT5880: {
    name: 'Rogers RT/duroid 5880',
    epsilonR: 2.2,
    muR: 1.0,
    sigma: 0.0,
    tanDelta: 0.0009
  }
};

export class MaterialManager {
  private materials: Record<string, Material>;
  
  constructor(initialMaterials: Record<string, Material> = DEFAULT_MATERIALS) {
    this.materials = { ...initialMaterials };
  }
  
  getMaterial(name: string): Material | undefined {
    return this.materials[name];
  }
  
  addMaterial(material: Material): void {
    this.materials[material.name] = material;
  }
  
  listMaterials(): string[] {
    return Object.keys(this.materials);
  }
  
  getAllMaterials(): Record<string, Material> {
    return { ...this.materials };
  }
}