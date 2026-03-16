import React, { useState } from 'react';
import AntennaDesigner from './components/AntennaDesigner';
import PatternViewer from './components/PatternViewer';
import ProjectManager from './components/ProjectManager';
import './App.css';

interface AntennaParams {
  frequency: number;
  gain: number;
  beamwidth: number;
  impedance: number;
  polarization: 'vertical' | 'horizontal' | 'circular';
  antennaType: 'dipole' | 'yagi' | 'patch' | 'horn';
}

interface Project {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  antennaType: string;
  frequency: number;
}

interface PatternData {
  theta: number[];
  phi: number[];
  gain: number[][];
  frequency: number;
  title?: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'design' | 'pattern' | 'projects'>('design');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [antennaParams, setAntennaParams] = useState<AntennaParams>({
    frequency: 2400,
    gain: 10,
    beamwidth: 60,
    impedance: 50,
    polarization: 'vertical',
    antennaType: 'dipole'
  });
  const [patternData, setPatternData] = useState<PatternData | undefined>();

  const handleDesignChange = (params: AntennaParams) => {
    setAntennaParams(params);
    // Generate sample pattern data for demonstration
    const theta = Array.from({ length: 36 }, (_, i) => (i * Math.PI) / 18);
    const phi = Array.from({ length: 72 }, (_, i) => (i * Math.PI) / 36);
    const gain = theta.map(t => 
      phi.map(p => {
        // Simple pattern calculation for demo
        const pattern = Math.cos(t) * Math.cos(p);
        return 20 * Math.log10(Math.max(0.01, Math.abs(pattern)));
      })
    );

    setPatternData({
      theta,
      phi,
      gain,
      frequency: params.frequency,
      title: `${params.antennaType} Pattern - ${params.frequency} MHz`
    });
  };

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project);
    // Load project data and update antenna parameters
    setAntennaParams(prev => ({
      ...prev,
      antennaType: project.antennaType as AntennaParams['antennaType'],
      frequency: project.frequency
    }));
  };

  const handleProjectCreate = () => {
    setActiveTab('design');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>PROMIN Antenna Studio</h1>
          <div className="project-info">
            {currentProject && (
              <span className="current-project">
                Project: {currentProject.name}
              </span>
            )}
          </div>
        </div>
        <nav className="tab-nav">
          <button
            className={activeTab === 'design' ? 'active' : ''}
            onClick={() => setActiveTab('design')}
          >
            Design
          </button>
          <button
            className={activeTab === 'pattern' ? 'active' : ''}
            onClick={() => setActiveTab('pattern')}
          >
            Pattern
          </button>
          <button
            className={activeTab === 'projects' ? 'active' : ''}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
        </nav>
      </header>

      <main className="app-main">
        <div className="tab-content">
          {activeTab === 'design' && (
            <AntennaDesigner onDesignChange={handleDesignChange} />
          )}
          {activeTab === 'pattern' && (
            <PatternViewer data={patternData} />
          )}
          {activeTab === 'projects' && (
            <ProjectManager
              onProjectSelect={handleProjectSelect}
              onProjectCreate={handleProjectCreate}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;