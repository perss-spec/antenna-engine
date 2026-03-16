import React, { useEffect, useState } from 'react';
import { getPatterns, deletePattern } from '../lib/tauri';
import type { AntennaPattern } from '../types';

interface PatternListProps {
  onPatternSelect: (pattern: AntennaPattern) => void;
  onPatternEdit: (pattern: AntennaPattern) => void;
  onPatternDelete: (id: string) => void;
  selectedPatternId?: string;
}

export function PatternList({ onPatternSelect, onPatternEdit, onPatternDelete, selectedPatternId }: PatternListProps) {
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
      const response = await getPatterns();
      
      if (response.success && response.data) {
        setPatterns(response.data);
      } else {
        setError(response.error || 'Failed to load patterns');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pattern?')) {
      return;
    }

    try {
      const response = await deletePattern(id);
      
      if (response.success) {
        setPatterns(patterns.filter(p => p.id !== id));
        onPatternDelete(id);
      } else {
        setError(response.error || 'Failed to delete pattern');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pattern');
    }
  };

  if (loading) {
    return (
      <div className="pattern-list loading">
        <div className="loading-spinner">Loading patterns...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pattern-list error">
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={loadPatterns}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pattern-list">
      <div className="pattern-list-header">
        <h3>Antenna Patterns</h3>
        <button className="btn btn-primary" onClick={loadPatterns}>
          Refresh
        </button>
      </div>
      
      {patterns.length === 0 ? (
        <div className="empty-state">
          <p>No antenna patterns found.</p>
          <p>Create your first pattern to get started.</p>
        </div>
      ) : (
        <div className="pattern-grid">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className={`pattern-card ${selectedPatternId === pattern.id ? 'selected' : ''}`}
              onClick={() => onPatternSelect(pattern)}
            >
              <div className="pattern-header">
                <h4 className="pattern-name">{pattern.name}</h4>
                <div className="pattern-actions">
                  <button
                    className="btn btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPatternEdit(pattern);
                    }}
                    title="Edit pattern"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-icon btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(pattern.id);
                    }}
                    title="Delete pattern"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="pattern-details">
                <div className="detail-row">
                  <span className="label">Frequency:</span>
                  <span className="value">{pattern.frequency} MHz</span>
                </div>
                <div className="detail-row">
                  <span className="label">Gain:</span>
                  <span className="value">{pattern.gain.toFixed(2)} dB</span>
                </div>
                <div className="detail-row">
                  <span className="label">Efficiency:</span>
                  <span className="value">{(pattern.efficiency * 100).toFixed(1)}%</span>
                </div>
                <div className="detail-row">
                  <span className="label">Polarization:</span>
                  <span className="value">{pattern.polarization}</span>
                </div>
              </div>
              
              <div className="pattern-footer">
                <small className="created-date">
                  Created: {new Date(pattern.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}