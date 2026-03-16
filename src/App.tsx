import React, { useState, useEffect, useCallback } from 'react';
import { AntennaViewport } from './components/AntennaViewport';
import { AntennaConfigPanel } from './components/AntennaConfigPanel';
import { S11Chart } from './components/S11Chart';
import { SmithChart } from './components/SmithChart';
import { RadiationPatternChart } from './components/RadiationPatternChart';
import { FileImport } from './components/FileImport';
import { MeshViewer } from './components/MeshViewer';
import { SolverPanel } from './components/SolverPanel';
import { SolverProgress } from './components/SolverProgress';
import { calculateAntennaParameters } from './utils/antennaCalculations';
import { AntennaConfig } from './types';

function App() {
  const [antennaConfig, setAntennaConfig] = useState<AntennaConfig>({
    type: 'monopole',
    length: 75,
    width: 2,
    height: 5,
    frequency: 2.4,
    substrate: {
      height: 1.6,
      permittivity: 4.4,
      tangentLoss: 0.02
    }
  });

  const [activeTab, setActiveTab] = useState<'s11' | 'smith' | 'radiation' | 'solver'>('s11');
  const [importedMesh, setImportedMesh] = useState<any>(null);
  const [solverResult, setSolverResult] = useState<any>(null);
  const [solverMode, setSolverMode] = useState<'analytical' | 'mom' | 'fdtd'>('analytical');
  const [isSimulating, setIsSimulating] = useState(false);

  const antennaData = calculateAntennaParameters(antennaConfig);

  const handleFileImport = useCallback((file: File, meshData: any) => {
    setImportedMesh(meshData);
    console.log('Mesh imported:', file.name, meshData);
  }, []);

  const handleSolverRun = useCallback(async (config: any) => {
    setIsSimulating(true);
    setSolverResult(null);

    try {
      // Simulate solver execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock results based on solver type
      const mockResult = {
        solverType: solverMode,
        s11Data: antennaData.s11Data.map(point => ({
          ...point,
          s11: point.s11 + (Math.random() - 0.5) * 2 // Add some variation
        })),
        smithData: antennaData.smithData,
        radiationData: antennaData.radiationData,
        convergence: Array.from({length: 20}, (_, i) => ({
          iteration: i + 1,
          error: Math.exp(-i * 0.3) * 1e-2
        }))
      };

      setSolverResult(mockResult);
    } catch (error) {
      console.error('Solver error:', error);
    } finally {
      setIsSimulating(false);
    }
  }, [solverMode, antennaData]);

  const handleSolverModeChange = useCallback((mode: 'analytical' | 'mom' | 'fdtd') => {
    setSolverMode(mode);
    setSolverResult(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (activeTab === 'solver') {
          handleSolverRun({});
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [activeTab, handleSolverRun]);

  // Get display data - use solver results if available, otherwise analytical
  const displayData = solverResult || antennaData;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Antenna Design Studio
          </h1>
          
          <div className="flex items-center gap-4">
            <FileImport onFileImport={handleFileImport} />
            
            <div className="flex items-center gap-2 text-sm">
              <span>Engine:</span>
              <select
                value={solverMode}
                onChange={(e) => handleSolverModeChange(e.target.value as any)}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white"
              >
                <option value="analytical">Analytical</option>
                <option value="mom">MoM</option>
                <option value="fdtd">FDTD</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-1">
            <AntennaConfigPanel
              config={antennaConfig}
              onChange={setAntennaConfig}
            />
          </div>

          {/* Center Panel - 3D Viewport */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-4 h-96 relative">
              {importedMesh ? (
                <MeshViewer meshData={importedMesh} />
              ) : (
                <AntennaViewport config={antennaConfig} />
              )}
              
              {importedMesh && (
                <div className="absolute top-4 right-4 bg-blue-600 px-2 py-1 rounded text-xs">
                  Imported Mesh
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Charts */}
          <div className="lg:col-span-1">
            {/* Tab Navigation */}
            <div className="flex bg-gray-800 rounded-t-lg overflow-hidden mb-0">
              <button
                onClick={() => setActiveTab('s11')}
                className={`px-4 py-2 text-sm font-medium flex-1 ${
                  activeTab === 's11'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                S11
              </button>
              <button
                onClick={() => setActiveTab('smith')}
                className={`px-4 py-2 text-sm font-medium flex-1 ${
                  activeTab === 'smith'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Smith
              </button>
              <button
                onClick={() => setActiveTab('radiation')}
                className={`px-4 py-2 text-sm font-medium flex-1 ${
                  activeTab === 'radiation'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Pattern
              </button>
              <button
                onClick={() => setActiveTab('solver')}
                className={`px-4 py-2 text-sm font-medium flex-1 ${
                  activeTab === 'solver'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Solver
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-gray-800 rounded-b-lg rounded-tr-lg p-4 h-96">
              {activeTab === 's11' && (
                <S11Chart data={displayData.s11Data} />
              )}
              
              {activeTab === 'smith' && (
                <SmithChart data={displayData.smithData} />
              )}
              
              {activeTab === 'radiation' && (
                <RadiationPatternChart data={displayData.radiationData} />
              )}
              
              {activeTab === 'solver' && (
                <div className="space-y-4">
                  <SolverPanel
                    onRun={handleSolverRun}
                    disabled={isSimulating}
                    solverType={solverMode}
                  />
                  
                  {(isSimulating || solverResult) && (
                    <SolverProgress
                      isRunning={isSimulating}
                      result={solverResult}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <div className="flex items-center justify-center gap-4">
            <span>Engine: {solverMode.toUpperCase()}</span>
            {solverResult && (
              <span className="text-green-400">• Results Available</span>
            )}
            {importedMesh && (
              <span className="text-blue-400">• Mesh Loaded</span>
            )}
            <span className="text-gray-500">• Ctrl+R to run simulation</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;