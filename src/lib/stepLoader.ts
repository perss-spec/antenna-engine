import { invoke } from '@tauri-apps/api/tauri';

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
}

export interface ImportedModel {
  mesh: {
    vertices: Array<{ x: number; y: number; z: number }>;
    triangles: Array<{ v0: number; v1: number; v2: number }>;
  };
  format: 'Stl' | 'Nec' | 'Nastran' | 'Step';
  metadata: {
    filename: string;
    file_size: number;
    vertex_count: number;
    triangle_count: number;
    properties: Record<string, string>;
  };
}

/**
 * Load a STEP file and convert it to Three.js-compatible mesh data
 * @param file The STEP file to load
 * @returns Promise resolving to mesh data for Three.js
 */
export async function loadStepFile(file: File): Promise<MeshData> {
  try {
    // Convert File to Uint8Array for Tauri
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    // Send file data to Rust backend
    const result: ImportedModel = await invoke('import_step_file', {
      filename: file.name,
      fileData: Array.from(fileData)
    });

    // Convert to Three.js format
    return convertToMeshData(result.mesh);
  } catch (error) {
    console.error('Failed to load STEP file:', error);
    throw new Error(`Failed to load STEP file: ${error}`);
  }
}

/**
 * Load any supported CAD file format
 * @param file The file to load
 * @returns Promise resolving to mesh data
 */
export async function loadCadFile(file: File): Promise<MeshData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    const result: ImportedModel = await invoke('import_cad_file', {
      filename: file.name,
      fileData: Array.from(fileData)
    });

    return convertToMeshData(result.mesh);
  } catch (error) {
    console.error('Failed to load CAD file:', error);
    throw new Error(`Failed to load CAD file: ${error}`);
  }
}

/**
 * Convert internal mesh format to Three.js-compatible format
 */
function convertToMeshData(mesh: ImportedModel['mesh']): MeshData {
  const vertices = new Float32Array(mesh.vertices.length * 3);
  const indices = new Uint32Array(mesh.triangles.length * 3);
  
  // Convert vertices
  for (let i = 0; i < mesh.vertices.length; i++) {
    const vertex = mesh.vertices[i];
    vertices[i * 3] = vertex.x;
    vertices[i * 3 + 1] = vertex.y;
    vertices[i * 3 + 2] = vertex.z;
  }
  
  // Convert triangles to indices
  for (let i = 0; i < mesh.triangles.length; i++) {
    const triangle = mesh.triangles[i];
    indices[i * 3] = triangle.v0;
    indices[i * 3 + 1] = triangle.v1;
    indices[i * 3 + 2] = triangle.v2;
  }
  
  // Calculate normals
  const normals = calculateNormals(vertices, indices);
  
  return {
    vertices,
    indices,
    normals
  };
}

/**
 * Calculate vertex normals from geometry
 */
function calculateNormals(vertices: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(vertices.length);
  const vertexCount = vertices.length / 3;
  
  // Initialize normals to zero
  normals.fill(0);
  
  // Calculate face normals and accumulate to vertices
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    
    // Get vertices
    const v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
    const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
    const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
    
    // Calculate edges
    const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    
    // Calculate cross product (normal)
    const normal = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0]
    ];
    
    // Add to vertex normals
    normals[i0] += normal[0];
    normals[i0 + 1] += normal[1];
    normals[i0 + 2] += normal[2];
    
    normals[i1] += normal[0];
    normals[i1 + 1] += normal[1];
    normals[i1 + 2] += normal[2];
    
    normals[i2] += normal[0];
    normals[i2 + 1] += normal[1];
    normals[i2 + 2] += normal[2];
  }
  
  // Normalize all vertex normals
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.sqrt(
      normals[i] * normals[i] + 
      normals[i + 1] * normals[i + 1] + 
      normals[i + 2] * normals[i + 2]
    );
    
    if (length > 0) {
      normals[i] /= length;
      normals[i + 1] /= length;
      normals[i + 2] /= length;
    }
  }
  
  return normals;
}

/**
 * Get supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['.step', '.stp', '.stl', '.nec', '.nas', '.bdf', '.nastran'];
}

/**
 * Check if a file extension is supported
 */
export function isSupportedFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ['step', 'stp', 'stl', 'nec', 'nas', 'bdf', 'nastran'].includes(ext || '');
}