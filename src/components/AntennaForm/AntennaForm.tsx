import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import './AntennaForm.css';

interface AntennaParameters {
  frequency: number;
  length: number;
  radius: number;
  height: number;
  material: string;
}

interface AntennaFormProps {
  parameters: AntennaParameters;
  onParametersChange: (params: AntennaParameters) => void;
  onSubmit: (params: AntennaParameters) => void;
  isSimulating?: boolean;
  className?: string;
}

const AntennaForm: FC<AntennaFormProps> = ({
  parameters,
  onParametersChange,
  onSubmit,
  isSimulating = false,
  className
}) => {
  const [localParams, setLocalParams] = useState<AntennaParameters>(parameters);

  const handleInputChange = useCallback((field: keyof AntennaParameters) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.type === 'number' 
      ? parseFloat(event.target.value) || 0
      : event.target.value;
    
    const updatedParams = { ...localParams, [field]: value };
    setLocalParams(updatedParams);
    onParametersChange(updatedParams);
  }, [localParams, onParametersChange]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    onSubmit(localParams);
  }, [localParams, onSubmit]);

  return (
    <div className={`antenna-form ${className || ''}`}>
      <div className="antenna-form-header">
        <h3>Dipole Antenna Parameters</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="antenna-form-content">
        <div className="form-group">
          <label htmlFor="frequency">Frequency (MHz)</label>
          <input
            id="frequency"
            type="number"
            value={localParams.frequency}
            onChange={handleInputChange('frequency')}
            min="1"
            max="10000"
            step="0.1"
            disabled={isSimulating}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="length">Length (mm)</label>
          <input
            id="length"
            type="number"
            value={localParams.length}
            onChange={handleInputChange('length')}
            min="0.1"
            max="1000"
            step="0.1"
            disabled={isSimulating}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="radius">Wire Radius (mm)</label>
          <input
            id="radius"
            type="number"
            value={localParams.radius}
            onChange={handleInputChange('radius')}
            min="0.01"
            max="10"
            step="0.01"
            disabled={isSimulating}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="height">Height Above Ground (mm)</label>
          <input
            id="height"
            type="number"
            value={localParams.height}
            onChange={handleInputChange('height')}
            min="0"
            max="10000"
            step="1"
            disabled={isSimulating}
          />
        </div>

        <div className="form-group">
          <label htmlFor="material">Material</label>
          <select
            id="material"
            value={localParams.material}
            onChange={handleInputChange('material')}
            disabled={isSimulating}
            required
          >
            <option value="copper">Copper</option>
            <option value="aluminum">Aluminum</option>
            <option value="silver">Silver</option>
            <option value="brass">Brass</option>
          </select>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            disabled={isSimulating}
            className="btn-primary"
          >
            {isSimulating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AntennaForm;