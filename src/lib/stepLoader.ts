import { invoke } from '@tauri-apps/api/tauri';

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;
  materials: Material[];
  metadata: ImportMetadata;
}

export interface Material {
  name: string;
  diffuse_color: [number, number, number];
  specular_color: [number, number, number];
  ambient_color: [number, number, number];
  shininess: number;
  opacity: number;
  texture_path?: string;
}

export interface ImportMetadata {
  filename: string;
  file_size: number;
  vertex_count: number;
  face_count: number;
  material_count: number;
  import_time_ms: number;
}

export interface ImportedModel {
  mesh: {
    vertices: Array<{
      position: [number, number, number];
      normal: [number, number, number];
      texture_coords: [number, number];
    }>;
    faces: Array<[number, number, number]>;
    materials: Material[];
    name: string;
  };
  format: string;
  metadata: ImportMetadata;
}

/**
 * Load a STEP file and convert it to Three.js compatible mesh data
 */
export async function loadStepFile(file: File): Promise<MeshData> {
  try {
    // Convert File to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Send file data to Tauri backend
    const result: ImportedModel = await invoke('import_step_file', {
      filename: file.name,
      fileData: Array.from(uint8Array)
    });

    return convertToMeshData(result);
  } catch (error) {
    console.error('Failed to load STEP file:', error);
    throw new Error(`STEP import failed: ${error}`);
  }
}

/**
 * Load any supported 3D file format
 */
export async function loadFile(file: File): Promise<MeshData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const result: ImportedModel = await invoke('import_file_data', {
      filename: file.name,
      fileData: Array.from(uint8Array)
    });

    return convertToMeshData(result);
  } catch (error) {
    console.error('Failed to load file:', error);
    throw new Error(`File import failed: ${error}`);
  }
}

/**
 * Convert ImportedModel to Three.js compatible MeshData
 */
function convertToMeshData(imported: ImportedModel): MeshData {
  const { mesh, metadata } = imported;
  
  // Extract vertex positions
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  
  mesh.vertices.forEach(vertex => {
    positions.push(...vertex.position);
    normals.push(...vertex.normal);
    uvs.push(...vertex.texture_coords);
  });
  
  // Extract face indices
  const indices: number[] = [];
  mesh.faces.forEach(face => {
    indices.push(...face);
  });
  
  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    materials: mesh.materials,
    metadata
  };
}

/**
 * Detect file format from extension
 */
export function detectFileFormat(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'stl':
      return 'STL';
    case 'nec':
      return 'NEC';
    case 'nas':
    case 'bdf':
    case 'nastran':
      return 'NASTRAN';
    case 'stp':
    case 'step':
      return 'STEP';
    default:
      return null;
  }
}

/**
 * Validate file before import
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024; // 100MB limit
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large (max 100MB)' };
  }
  
  const format = detectFileFormat(file.name);
  if (!format) {
    return { valid: false, error: 'Unsupported file format' };
  }
  
  return { valid: true };
}