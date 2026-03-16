import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { AntennaPattern, TauriResponse } from '../types/antenna';

interface PatternListProps {
  onPatternSelect: (pattern: AntennaPattern) => void;
  selectedPatternId?: string;
  className?: string;
}

const PatternList: React.FC<PatternListProps> = ({ 
  onPatternSelect, 
  selectedPatternId,
  className = '' 
}) => {
  const [patterns, setPatterns] = useState<AntennaPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await invoke<TauriResponse<AntennaPattern[]>>('get_antenna_patterns');
      
      if (response.success && response.data) {
        setPatterns(response.data);
      } else {
        setError(response.error || 'Failed to load patterns');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (patternId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this pattern?')) {
      return;
    }

    try {
      const response = await invoke<TauriResponse<void>>('delete_antenna_pattern', { 
        patternId 
      });
      
      if (response.success) {
        setPatterns(prev => prev.filter(p => p.id !== patternId));
      } else {
        setError(response.error || 'Failed to delete pattern');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pattern');
    }
  };

  if (loading) {
    return (
      <div className={`pattern-list loading ${className}`}>
        <div className="loading-spinner">Loading patterns...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`pattern-list error ${className}`}>
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={loadPatterns} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pattern-list ${className}`}>
      <div className="pattern-list-header">
        <h3>Antenna Patterns</h3>
        <button onClick={loadPatterns} className="refresh-button">
          Refresh
        </button>
      </div>
      
      <div className="pattern-items">
        {patterns.length === 0 ? (
          <div className="empty-state">
            <p>No antenna patterns found.</p>
            <p>Import or create a new pattern to get started.</p>
          </div>
        ) : (
          patterns.map(pattern => (
            <div
              key={pattern.id}
              className={`pattern-item ${selectedPatternId === pattern.id ? 'selected' : ''}`}
              onClick={() => onPatternSelect(pattern)}
            >
              <div className="pattern-info">
                <h4 className="pattern-name">{pattern.name}</h4>
                <div className="pattern-details">
                  <span className="frequency">{pattern.frequency.toFixed(2)} MHz</span>
                  <span className="polarization">{pattern.polarization}</span>
                </div>
                <div className="pattern-meta">
                  <span className="date">
                    {new Date(pattern.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="pattern-actions">
                <button
                  onClick={(e) => handleDelete(pattern.id, e)}
                  className="delete-button"
                  title="Delete pattern"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PatternList;