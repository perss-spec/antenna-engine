import { invoke } from '@tauri-apps/api/core';

export interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
}

export interface ImportMetadata {
  filename: string;
  file_size: number;
  vertex_count: number;
  face_count: number;
  units?: string;
  description?: string;
}

export interface ImportedModel {
  mesh: MeshData;
  format: 'Stl' | 'Nec' | 'Nastran' | 'Step';
  metadata: ImportMetadata;
}

export async function loadStepFile(file: File): Promise<ImportedModel> {
  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Send file data to Tauri backend
    const result = await invoke<ImportedModel>('import_step_file', {
      filename: file.name,
      fileData: Array.from(uint8Array)
    });
    
    return result;
  } catch (error) {
    console.error('Error loading STEP file:', error);
    throw new Error(`Failed to load STEP file: ${error}`);
  }
}

export async function loadAnyFile(file: File): Promise<ImportedModel> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const result = await invoke<ImportedModel>('import_any_file', {
      filename: file.name,
      fileData: Array.from(uint8Array)
    });
    
    return result;
  } catch (error) {
    console.error('Error loading file:', error);
    throw new Error(`Failed to load file: ${error}`);
  }
}

export function createThreeJSGeometry(meshData: MeshData) {
  // Helper function to create Three.js geometry from mesh data
  // This would typically be used with THREE.BufferGeometry
  return {
    vertices: new Float32Array(meshData.vertices),
    indices: new Uint32Array(meshData.indices),
    normals: new Float32Array(meshData.normals),
  };
}

export async function detectFileFormat(filename: string): Promise<string> {
  try {
    const format = await invoke<string>('detect_file_format', {
      filename
    });
    return format;
  } catch (error) {
    console.error('Error detecting file format:', error);
    throw new Error(`Failed to detect file format: ${error}`);
  }
}

// Utility function to validate STEP file before processing
export function validateStepFile(file: File): boolean {
  const validExtensions = ['.stp', '.step'];
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  return validExtensions.includes(extension);
}

// Progress callback type for large file imports
export type ImportProgressCallback = (progress: number, message: string) => void;

export async function loadStepFileWithProgress(
  file: File,
  onProgress?: ImportProgressCallback
): Promise<ImportedModel> {
  try {
    onProgress?.(10, 'Reading file...');
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    onProgress?.(30, 'Sending to parser...');
    
    const result = await invoke<ImportedModel>('import_step_file', {
      filename: file.name,
      fileData: Array.from(uint8Array)
    });
    
    onProgress?.(80, 'Processing geometry...');
    
    // Validate result
    if (!result.mesh || !result.mesh.vertices || result.mesh.vertices.length === 0) {
      throw new Error('Invalid geometry data received');
    }
    
    onProgress?.(100, 'Complete');
    
    return result;
  } catch (error) {
    onProgress?.(0, `Error: ${error}`);
    throw error;
  }
}