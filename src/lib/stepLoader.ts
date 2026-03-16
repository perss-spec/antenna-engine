import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile } from '@tauri-apps/api/fs';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vertex {
  position: Vec3;
  normal?: Vec3;
}

export interface Face {
  vertices: [number, number, number];
  material_id?: number;
}

export interface MeshData {
  vertices: Vertex[];
  faces: Face[];
}

export interface ImportMetadata {
  filename: string;
  file_size: number;
  vertex_count: number;
  face_count: number;
  import_time_ms: number;
  units?: string;
  comments: string[];
}

export interface ImportedModel {
  mesh: MeshData;
  format: 'Stl' | 'Nec' | 'Nastran' | 'Step';
  metadata: ImportMetadata;
}

export class StepLoaderError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'StepLoaderError';
  }
}

/**
 * Load a STEP file from the user's file system
 */
export async function loadStepFileDialog(): Promise<ImportedModel> {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'STEP Files',
        extensions: ['stp', 'step']
      }]
    });

    if (!selected || Array.isArray(selected)) {
      throw new StepLoaderError('No file selected');
    }

    return await loadStepFromPath(selected);
  } catch (error) {
    if (error instanceof StepLoaderError) {
      throw error;
    }
    throw new StepLoaderError('Failed to open file dialog', error as Error);
  }
}

/**
 * Load a STEP file from a given file path
 */
export async function loadStepFromPath(filePath: string): Promise<ImportedModel> {
  try {
    const result = await invoke<ImportedModel>('import_step_file', {
      path: filePath
    });

    if (!result || !result.mesh) {
      throw new StepLoaderError('Invalid response from backend');
    }

    validateMeshData(result.mesh);
    return result;
  } catch (error) {
    if (error instanceof StepLoaderError) {
      throw error;
    }
    throw new StepLoaderError(`Failed to load STEP file: ${filePath}`, error as Error);
  }
}

/**
 * Load a STEP file from a File object (e.g., from drag & drop)
 */
export async function loadStepFile(file: File): Promise<ImportedModel> {
  try {
    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const result = await invoke<ImportedModel>('import_step_data', {
      filename: file.name,
      data: Array.from(uint8Array)
    });

    if (!result || !result.mesh) {
      throw new StepLoaderError('Invalid response from backend');
    }

    validateMeshData(result.mesh);
    return result;
  } catch (error) {
    if (error instanceof StepLoaderError) {
      throw error;
    }
    throw new StepLoaderError(`Failed to load STEP file: ${file.name}`, error as Error);
  }
}

/**
 * Convert MeshData to Three.js compatible format
 */
export function meshDataToThreeJS(meshData: MeshData) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Extract vertex positions and normals
  for (const vertex of meshData.vertices) {
    positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
    
    if (vertex.normal) {
      normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
    } else {
      normals.push(0, 0, 1); // Default normal
    }
  }

  // Extract face indices
  for (const face of meshData.faces) {
    indices.push(face.vertices[0], face.vertices[1], face.vertices[2]);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: meshData.vertices.length,
    faceCount: meshData.faces.length
  };
}

/**
 * Validate mesh data structure
 */
function validateMeshData(meshData: MeshData): void {
  if (!meshData.vertices || !Array.isArray(meshData.vertices)) {
    throw new StepLoaderError('Invalid vertices data');
  }

  if (!meshData.faces || !Array.isArray(meshData.faces)) {
    throw new StepLoaderError('Invalid faces data');
  }

  if (meshData.vertices.length === 0) {
    throw new StepLoaderError('Mesh contains no vertices');
  }

  if (meshData.faces.length === 0) {
    throw new StepLoaderError('Mesh contains no faces');
  }

  // Validate face indices
  for (let i = 0; i < meshData.faces.length; i++) {
    const face = meshData.faces[i];
    if (!face.vertices || face.vertices.length !== 3) {
      throw new StepLoaderError(`Invalid face at index ${i}: must have exactly 3 vertices`);
    }

    for (const vertexIndex of face.vertices) {
      if (vertexIndex < 0 || vertexIndex >= meshData.vertices.length) {
        throw new StepLoaderError(`Face ${i} references invalid vertex index ${vertexIndex}`);
      }
    }
  }
}

/**
 * Get supported STEP file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['stp', 'step'];
}

/**
 * Check if a file is a supported STEP file
 */
export function isStepFile(filename: string): boolean {
  const extension = filename.toLowerCase().split('.').pop();
  return getSupportedExtensions().includes(extension || '');
}

/**
 * Estimate memory usage for a mesh
 */
export function estimateMemoryUsage(meshData: MeshData): {
  vertices: number;
  faces: number;
  total: number;
  humanReadable: string;
} {
  // Each vertex: 3 floats (position) + 3 floats (normal) = 24 bytes
  const vertexBytes = meshData.vertices.length * 24;
  
  // Each face: 3 integers = 12 bytes
  const faceBytes = meshData.faces.length * 12;
  
  const total = vertexBytes + faceBytes;
  
  const humanReadable = total > 1024 * 1024 
    ? `${(total / (1024 * 1024)).toFixed(2)} MB`
    : total > 1024
    ? `${(total / 1024).toFixed(2)} KB`
    : `${total} bytes`;

  return {
    vertices: vertexBytes,
    faces: faceBytes,
    total,
    humanReadable
  };
}