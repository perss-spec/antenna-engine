import React, { useState, useEffect } from 'react';
import { createPattern, updatePattern } from '../lib/tauri';
import type { AntennaPattern } from '../types';

interface PatternEditorProps {
  pattern?: AntennaPattern;
  onSave: (pattern: AntennaPattern) => void;
  onCancel: () => void;
}

interface PatternFormData {
  name: string;
  frequency: number;
  gain: number;
  directivity: number;
  efficiency: number;
  beamwidth: number;
  polarization: 'linear' | 'circular' | 'elliptical';
}

export function PatternEditor({ pattern, onSave, onCancel }: PatternEditorProps) {
  const [formData, setFormData] = useState<PatternFormData>({
    name: '',
    frequency: 2400,
    gain: 0,
    directivity: 1,
    efficiency: 0.9,
    beamwidth: 60,
    polarization: 'linear'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pattern) {
      setFormData({
        name: pattern.name,
        frequency: pattern.frequency,
        gain: pattern.gain,
        directivity: pattern.directivity,
        efficiency: pattern.efficiency,
        beamwidth: pattern.beamwidth,
        polarization: pattern.polarization
      });
    }
  }, [pattern]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Pattern name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      if (pattern) {
        response = await updatePattern(pattern.id, formData);
      } else {
        response = await createPattern(formData);
      }
      
      if (response.success && response.data) {
        onSave(response.data);
      } else {
        setError(response.error || 'Failed to save pattern');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pattern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pattern-editor">
      <div className="editor-header">
        <h3>{pattern ? 'Edit Pattern' : 'Create New Pattern'}</h3>
        <button className="btn btn-text" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form className="editor-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Pattern Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            disabled={loading}
            className="form-control"
            placeholder="Enter pattern name"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="frequency">Frequency (MHz)</label>
            <input
              type="number"
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleInputChange}
              min="1"
              max="100000"
              step="0.1"
              required
              disabled={loading}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="gain">Gain (dB)</label>
            <input
              type="number"
              id="gain"
              name="gain"
              value={formData.gain}
              onChange={handleInputChange}
              step="0.1"
              required
              disabled={loading}
              className="form-control"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="directivity">Directivity</label>
            <input
              type="number"
              id="directivity"
              name="directivity"
              value={formData.directivity}
              onChange={handleInputChange}
              min="1"
              step="0.1"
              required
              disabled={loading}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="efficiency">Efficiency (0-1)</label>
            <input
              type="number"
              id="efficiency"
              name="efficiency"
              value={formData.efficiency}
              onChange={handleInputChange}
              min="0"
              max="1"
              step="0.01"
              required
              disabled={loading}
              className="form-control"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="beamwidth">Beamwidth (degrees)</label>
            <input
              type="number"
              id="beamwidth"
              name="beamwidth"
              value={formData.beamwidth}
              onChange={handleInputChange}
              min="1"
              max="360"
              step="1"
              required
              disabled={loading}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="polarization">Polarization</label>
            <select
              id="polarization"
              name="polarization"
              value={formData.polarization}
              onChange={handleInputChange}
              required
              disabled={loading}
              className="form-control"
            >
              <option value="linear">Linear</option>
              <option value="circular">Circular</option>
              <option value="elliptical">Elliptical</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : pattern ? 'Update Pattern' : 'Create Pattern'}
          </button>
        </div>
      </form>
    </div>
  );
}