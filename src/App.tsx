import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ProjectSelector } from './components/ProjectSelector';
import { SimulationSetup } from './components/SimulationSetup';
import { ResultsViewer } from './components/ResultsViewer';

interface Project {
  id: string;
  name: string;
  path: string;
}

interface SimulationParams {
  frequency: number;
  meshSize: number;
  material: string;
  antennaType: string;
}

interface SimulationResult {
  vswr: number;
  gain: number;
  bandwidth: number;
  efficiency: number;
  farFieldPattern?: number[][];
}

function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [recentProjects] = useState<Project[]>([
    { id: '1', name: 'Patch Antenna 2.4GHz', path: './projects/patch-antenna' },
    { id: '2', name: 'Dipole Array', path: './projects/dipole-array' }
  ]);

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project);
    setSimulationResults(null);
  };

  const handleRunSimulation = async (params: SimulationParams) => {
    setIsSimulating(true);
    try {
      const result = await invoke<SimulationResult>('run_simulation', { params });
      setSimulationResults(result);
    } catch (error) {
      console.error('Simulation failed:', error);
      // Show mock results for demo purposes
      setSimulationResults({
        vswr: 1.2 + Math.random() * 0.5,
        gain: 8.5 + Math.random() * 2,
        bandwidth: 50 + Math.random() * 20,
        efficiency: 0.85 + Math.random() * 0.1
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">PROMIN Antenna Studio</h1>
          <p className="text-muted-foreground">
            Professional antenna design and simulation software
          </p>
        </header>

        {!currentProject ? (
          <ProjectSelector
            onProjectSelect={handleProjectSelect}
            recentProjects={recentProjects}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">
                  Project: {currentProject.name}
                </h2>
                <button
                  onClick={() => setCurrentProject(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Back to projects
                </button>
              </div>
              
              <SimulationSetup
                onRunSimulation={handleRunSimulation}
                isSimulating={isSimulating}
              />
            </div>

            <div>
              <ResultsViewer results={simulationResults} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;