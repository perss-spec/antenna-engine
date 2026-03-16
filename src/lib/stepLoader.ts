import { invoke } from '@tauri-apps/api/tauri';

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  metadata: {
    filename: string;
    fileSize: number;
    vertexCount: number;
    faceCount: number;
    format: string;
    units?: string;
  };
}

export interface ImportedModel {
  mesh: {
    vertices: Array<{
      position: [number, number, number];
      normal?: [number, number, number];
    }>;
    faces: Array<{
      vertices: [number, number, number];
      normal?: [number, number, number];
    }>;
  };
  format: 'Stl' | 'Nec' | 'Nastran' | 'Step';
  metadata: {
    filename: string;
    file_size: number;
    vertex_count: number;
    face_count: number;
    bounds?: {
      min: [number, number, number];
      max: [number, number, number];
    };
    units?: string;
    source_info?: string;
  };
}

/**
 * Load a STEP file and convert it to mesh data for Three.js
 */
export async function loadStepFile(file: File): Promise<MeshData> {
  try {
    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    // Send file data to Tauri backend
    const result: ImportedModel = await invoke('import_step_file', {
      filename: file.name,
      fileData: Array.from(fileData)
    });
    
    return convertToMeshData(result);
  } catch (error) {
    console.error('Failed to load STEP file:', error);
    throw new Error(`Failed to load STEP file: ${error}`);
  }
}

/**
 * Load any supported geometry file format
 */
export async function loadGeometryFile(file: File): Promise<MeshData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    const result: ImportedModel = await invoke('import_geometry_file', {
      filename: file.name,
      fileData: Array.from(fileData)
    });
    
    return convertToMeshData(result);
  } catch (error) {
    console.error('Failed to load geometry file:', error);
    throw new Error(`Failed to load geometry file: ${error}`);
  }
}

/**
 * Convert ImportedModel to Three.js compatible MeshData
 */
function convertToMeshData(importedModel: ImportedModel): MeshData {
  const { mesh, metadata } = importedModel;
  
  // Extract vertex positions
  const vertexCount = mesh.vertices.length;
  const vertices = new Float32Array(vertexCount * 3);
  
  for (let i = 0; i < vertexCount; i++) {
    const vertex = mesh.vertices[i];
    vertices[i * 3] = vertex.position[0];
    vertices[i * 3 + 1] = vertex.position[1];
    vertices[i * 3 + 2] = vertex.position[2];
  }
  
  // Extract face indices
  const faceCount = mesh.faces.length;
  const indices = new Uint32Array(faceCount * 3);
  
  for (let i = 0; i < faceCount; i++) {
    const face = mesh.faces[i];
    indices[i * 3] = face.vertices[0];
    indices[i * 3 + 1] = face.vertices[1];
    indices[i * 3 + 2] = face.vertices[2];
  }
  
  // Extract or calculate normals
  let normals: Float32Array | undefined;
  
  if (mesh.vertices.some(v => v.normal)) {
    normals = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const normal = mesh.vertices[i].normal || [0, 0, 1];
      normals[i * 3] = normal[0];
      normals[i * 3 + 1] = normal[1];
      normals[i * 3 + 2] = normal[2];
    }
  } else {
    // Calculate vertex normals from face normals
    normals = calculateVertexNormals(vertices, indices);
  }
  
  return {
    vertices,
    indices,
    normals,
    bounds: metadata.bounds || {
      min: [0, 0, 0],
      max: [0, 0, 0]
    },
    metadata: {
      filename: metadata.filename,
      fileSize: metadata.file_size,
      vertexCount: metadata.vertex_count,
      faceCount: metadata.face_count,
      format: importedModel.format,
      units: metadata.units
    }
  };
}

/**
 * Calculate vertex normals from face data
 */
function calculateVertexNormals(vertices: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(vertices.length);
  const vertexNormals: Array<[number, number, number]> = [];
  
  // Initialize vertex normals
  for (let i = 0; i < vertices.length / 3; i++) {
    vertexNormals.push([0, 0, 0]);
  }
  
  // Calculate face normals and accumulate to vertices
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];
    
    // Get vertex positions
    const v0 = [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]];
    const v1 = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
    const v2 = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];
    
    // Calculate face normal
    const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    
    const normal = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0]
    ];
    
    // Accumulate to vertex normals
    vertexNormals[i0][0] += normal[0];
    vertexNormals[i0][1] += normal[1];
    vertexNormals[i0][2] += normal[2];
    
    vertexNormals[i1][0] += normal[0];
    vertexNormals[i1][1] += normal[1];
    vertexNormals[i1][2] += normal[2];
    
    vertexNormals[i2][0] += normal[0];
    vertexNormals[i2][1] += normal[1];
    vertexNormals[i2][2] += normal[2];
  }
  
  // Normalize vertex normals
  for (let i = 0; i < vertexNormals.length; i++) {
    const normal = vertexNormals[i];
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
    
    if (length > 0) {
      normal[0] /= length;
      normal[1] /= length;
      normal[2] /= length;
    }
    
    normals[i * 3] = normal[0];
    normals[i * 3 + 1] = normal[1];
    normals[i * 3 + 2] = normal[2];
  }
  
  return normals;
}

/**
 * Validate that a file is a supported geometry format
 */
export function isSupportedGeometryFile(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop();
  const supportedExtensions = ['stl', 'nec', 'nas', 'nastran', 'bdf', 'step', 'stp'];
  return supportedExtensions.includes(extension || '');
}

/**
 * Get file format from filename
 */
export function getFileFormat(filename: string): string | null {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'stl':
      return 'STL';
    case 'nec':
      return 'NEC';
    case 'nas':
    case 'nastran':
    case 'bdf':
      return 'NASTRAN';
    case 'step':
    case 'stp':
      return 'STEP';
    default:
      return null;
  }
}