import { invoke } from '@tauri-apps/api/tauri';

export interface MeshData {
  vertices: number[];
  indices: number[];
  normals?: number[];
  metadata?: {
    vertexCount: number;
    triangleCount: number;
    units?: string;
    description?: string;
    format: string;
  };
}

export interface ImportResult {
  mesh: {
    vertices: Array<{ x: number; y: number; z: number }>;
    triangles: Array<{ v0: number; v1: number; v2: number }>;
  };
  format: string;
  metadata: {
    file_size: number;
    vertex_count: number;
    triangle_count: number;
    units?: string;
    description?: string;
    imported_at: string;
  };
}

export class StepLoadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'StepLoadError';
  }
}

export async function loadStepFile(file: File): Promise<MeshData> {
  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Send file data to Tauri backend
    const result: ImportResult = await invoke('import_step_file', {
      filename: file.name,
      fileData: Array.from(uint8Array),
    });

    // Convert backend format to Three.js compatible format
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Extract vertices
    result.mesh.vertices.forEach(vertex => {
      vertices.push(vertex.x, vertex.y, vertex.z);
    });

    // Extract indices and calculate normals
    result.mesh.triangles.forEach(triangle => {
      indices.push(triangle.v0, triangle.v1, triangle.v2);
      
      // Calculate face normal
      const v0 = result.mesh.vertices[triangle.v0];
      const v1 = result.mesh.vertices[triangle.v1];
      const v2 = result.mesh.vertices[triangle.v2];
      
      const edge1 = {
        x: v1.x - v0.x,
        y: v1.y - v0.y,
        z: v1.z - v0.z
      };
      
      const edge2 = {
        x: v2.x - v0.x,
        y: v2.y - v0.y,
        z: v2.z - v0.z
      };
      
      // Cross product for normal
      const normal = {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x
      };
      
      // Normalize
      const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
      if (length > 0) {
        normal.x /= length;
        normal.y /= length;
        normal.z /= length;
      }
      
      // Add normal for each vertex of the triangle
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
    });

    return {
      vertices,
      indices,
      normals,
      metadata: {
        vertexCount: result.metadata.vertex_count,
        triangleCount: result.metadata.triangle_count,
        units: result.metadata.units,
        description: result.metadata.description,
        format: result.format
      }
    };

  } catch (error) {
    console.error('Failed to load STEP file:', error);
    
    if (error instanceof Error) {
      throw new StepLoadError(`Failed to load STEP file: ${error.message}`, error);
    } else {
      throw new StepLoadError('Failed to load STEP file: Unknown error');
    }
  }
}

export async function validateStepFile(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    
    // Basic STEP file validation
    const hasStepHeader = text.includes('ISO-10303') || text.includes('STEP');
    const hasStepSections = text.includes('HEADER;') && text.includes('DATA;') && text.includes('ENDSEC;');
    
    return hasStepHeader && hasStepSections;
  } catch {
    return false;
  }
}

export function getStepFileInfo(file: File): {
  name: string;
  size: string;
  type: string;
  lastModified: string;
} {
  return {
    name: file.name,
    size: formatFileSize(file.size),
    type: file.type || 'application/step',
    lastModified: new Date(file.lastModified).toLocaleDateString()
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export utility functions for STEP file handling
export const stepUtils = {
  validateStepFile,
  getStepFileInfo,
  formatFileSize
};