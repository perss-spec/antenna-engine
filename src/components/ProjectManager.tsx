import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Project {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  antennaType: string;
  frequency: number;
}

interface ProjectManagerProps {
  onProjectSelect?: (project: Project) => void;
  onProjectCreate?: () => void;
  className?: string;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({
  onProjectSelect,
  onProjectCreate,
  className
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const projectList = await invoke<Project[]>('get_projects');
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      const project: Omit<Project, 'id' | 'created' | 'modified'> = {
        name: newProjectName.trim(),
        description: newProjectDescription.trim(),
        antennaType: 'dipole',
        frequency: 2400
      };

      const createdProject = await invoke<Project>('create_project', { project });
      setProjects(prev => [createdProject, ...prev]);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateDialog(false);
      onProjectCreate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      console.error('Failed to create project:', err);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await invoke('delete_project', { projectId });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      console.error('Failed to delete project:', err);
    }
  };

  const selectProject = (project: Project) => {
    setSelectedProject(project);
    onProjectSelect?.(project);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`project-manager ${className || ''}`}>
      <div className="project-header">
        <h2>Projects</h2>
        <button
          className="create-project-btn"
          onClick={() => setShowCreateDialog(true)}
        >
          New Project
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet</p>
          <button onClick={() => setShowCreateDialog(true)}>
            Create your first project
          </button>
        </div>
      ) : (
        <div className="project-list">
          {projects.map(project => (
            <div
              key={project.id}
              className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
              onClick={() => selectProject(project)}
            >
              <div className="project-info">
                <h3>{project.name}</h3>
                <p className="project-description">{project.description}</p>
                <div className="project-meta">
                  <span className="antenna-type">{project.antennaType}</span>
                  <span className="frequency">{project.frequency} MHz</span>
                </div>
                <div className="project-dates">
                  <span>Created: {formatDate(project.created)}</span>
                  {project.modified !== project.created && (
                    <span>Modified: {formatDate(project.modified)}</span>
                  )}
                </div>
              </div>
              <div className="project-actions">
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Create New Project</h3>
            <div className="dialog-content">
              <label>
                Project Name:
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                />
              </label>
              <label>
                Description (optional):
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Enter project description"
                  rows={3}
                />
              </label>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button onClick={createProject} disabled={!newProjectName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;