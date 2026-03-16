import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface MeshData {
  vertices: number;
  triangles: number;
  segments: number;
  file_path: string;
  file_name: string;
  file_size: number;
  format: string;
}

interface FileImportProps {
  onMeshImported: (mesh: MeshData) => void;
  onError: (error: string) => void;
}

interface FileHistoryItem {
  name: string;
  path: string;
  format: string;
  size: number;
  imported_at: string;
  mesh_stats: {
    vertices: number;
    triangles: number;
    segments: number;
  };
}

const SUPPORTED_FORMATS = ['.stl', '.nec', '.nas', '.nastran', '.step', '.stp'];

export default function FileImport({ onMeshImported, onError }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileHistory, setFileHistory] = useState<FileHistoryItem[]>([]);
  const [lastImported, setLastImported] = useState<MeshData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectFileType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'stl': return 'STL';
      case 'nec': return 'NEC';
      case 'nas':
      case 'nastran': return 'NASTRAN';
      case 'step':
      case 'stp': return 'STEP';
      default: return 'Unknown';
    }
  };

  const isValidFile = (fileName: string): boolean => {
    const ext = '.' + fileName.toLowerCase().split('.').pop();
    return SUPPORTED_FORMATS.includes(ext);
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const importFile = async (file: File) => {
    if (!isValidFile(file.name)) {
      onError(`Unsupported file format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setCurrentFile(file.name);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      const result = await invoke<MeshData>('import_cad_file', {
        filePath: file.path || file.name,
        fileType: detectFileType(file.name).toLowerCase()
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      // Add to history
      const historyItem: FileHistoryItem = {
        name: file.name,
        path: file.path || file.name,
        format: detectFileType(file.name),
        size: file.size,
        imported_at: new Date().toISOString(),
        mesh_stats: {
          vertices: result.vertices,
          triangles: result.triangles,
          segments: result.segments
        }
      };

      setFileHistory(prev => [historyItem, ...prev.slice(0, 4)]);
      setLastImported(result);
      onMeshImported(result);

      setTimeout(() => {
        setIsImporting(false);
        setCurrentFile(null);
        setImportProgress(0);
      }, 1000);

    } catch (error) {
      setIsImporting(false);
      setCurrentFile(null);
      setImportProgress(0);
      onError(`Failed to import file: ${error}`);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      importFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      importFile(files[0]);
    }
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Import CAD File</h3>
        <div className="flex items-center text-sm text-gray-500">
          <DocumentIcon className="w-4 h-4 mr-1" />
          Supports: STL, NEC, NASTRAN, STEP
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : isImporting 
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".stl,.nec,.nas,.nastran,.step,.stp"
          onChange={handleFileSelect}
          disabled={isImporting}
        />

        {isImporting ? (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CloudArrowUpIcon className="w-6 h-6 text-green-600 animate-bounce" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">
                Importing {currentFile}...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {Math.round(importProgress)}% complete
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <CloudArrowUpIcon className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your CAD file here
              </p>
              <p className="text-sm text-gray-500">
                or <span className="text-blue-600 font-medium cursor-pointer">browse files</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Last Imported Stats */}
      {lastImported && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="font-medium text-green-900">Import Successful</h4>
            </div>
            <span className="text-sm text-green-700">{lastImported.format}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-green-900">
                {lastImported.vertices.toLocaleString()}
              </div>
              <div className="text-green-700">Vertices</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-900">
                {lastImported.triangles.toLocaleString()}
              </div>
              <div className="text-green-700">Triangles</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-900">
                {lastImported.segments.toLocaleString()}
              </div>
              <div className="text-green-700">Segments</div>
            </div>
          </div>
        </div>
      )}

      {/* File History */}
      {fileHistory.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center">
            <ClockIcon className="w-4 h-4 text-gray-500 mr-2" />
            <h4 className="font-medium text-gray-900">Recent Imports</h4>
          </div>
          <div className="space-y-2">
            {fileHistory.map((item, index) => (
              <div 
                key={`${item.path}-${item.imported_at}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => onMeshImported({
                  vertices: item.mesh_stats.vertices,
                  triangles: item.mesh_stats.triangles,
                  segments: item.mesh_stats.segments,
                  file_path: item.path,
                  file_name: item.name,
                  file_size: item.size,
                  format: item.format
                })}
              >
                <div className="flex items-center space-x-3">
                  <DocumentIcon className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-48">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(item.size)} • {item.format}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center">
                    <ChartBarIcon className="w-3 h-3 mr-1" />
                    {item.mesh_stats.vertices.toLocaleString()}v
                  </div>
                  <div className="text-right">
                    {new Date(item.imported_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}