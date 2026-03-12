import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import './AntennaForm.css';

interface DipoleParams {
  length: number; // meters
  radius: number; // meters
  frequency: number; // Hz
  segments: number;
}

interface AntennaFormProps {
  onSubmit: (params: DipoleParams) => void;
  isSimulating?: boolean;
  initialParams?: Partial<DipoleParams>;
  className?: string;
}

const DEFAULT_PARAMS: DipoleParams = {
  length: 0.15, // 15cm dipole
  radius: 0.001, // 1mm wire radius
  frequency: 1e9, // 1 GHz
  segments: 21
};

const AntennaForm: FC<AntennaFormProps> = ({ 
  onSubmit, 
  isSimulating = false, 
  initialParams = {}, 
  className = '' 
}) => {
  const [params, setParams] = useState<DipoleParams>({
    ...DEFAULT_PARAMS,
    ...initialParams
  });

  const [errors, setErrors] = useState<Partial<Record<keyof DipoleParams, string>>>({});

  const validateParams = useCallback((newParams: DipoleParams): boolean => {
    const newErrors: Partial<Record<keyof DipoleParams, string>> = {};

    if (newParams.length <= 0) {
      newErrors.length = 'Length must be positive';
    } else if (newParams.length > 10) {
      newErrors.length = 'Length must be less than 10m';
    }

    if (newParams.radius <= 0) {
      newErrors.radius = 'Radius must be positive';
    } else if (newParams.radius >= newParams.length / 2) {
      newErrors.radius = 'Radius must be less than half the length';
    }

    if (newParams.frequency <= 0) {
      newErrors.frequency = 'Frequency must be positive';
    } else if (newParams.frequency > 100e9) {
      newErrors.frequency = 'Frequency must be less than 100 GHz';
    }

    if (newParams.segments < 3) {
      newErrors.segments = 'Minimum 3 segments required';
    } else if (newParams.segments > 1000) {
      newErrors.segments = 'Maximum 1000 segments allowed';
    } else if (newParams.segments % 2 === 0) {
      newErrors.segments = 'Segments must be odd for center feed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  const handleInputChange = useCallback((field: keyof DipoleParams) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(e.target.value) || 0;
    const newParams = { ...params, [field]: value };
    setParams(newParams);
    
    // Clear error for this field if it becomes valid
    if (errors[field]) {
      validateParams(newParams);
    }
  }, [params, errors, validateParams]);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    
    if (validateParams(params)) {
      onSubmit(params);
    }
  }, [params, validateParams, onSubmit]);

  const formatFrequencyDisplay = (freq: number): string => {
    if (freq >= 1e9) {
      return `${(freq / 1e9).toFixed(2)} GHz`;
    } else if (freq >= 1e6) {
      return `${(freq / 1e6).toFixed(1)} MHz`;
    } else if (freq >= 1e3) {
      return `${(freq / 1e3).toFixed(1)} kHz`;
    }
    return `${freq.toFixed(0)} Hz`;
  };

  return (
    <form className={`antenna-form ${className}`} onSubmit={handleSubmit}>
      <h3 className="antenna-form__title">Dipole Antenna Parameters</h3>
      
      <div className="antenna-form__grid">
        <div className="antenna-form__field">
          <label htmlFor="length" className="antenna-form__label">
            Length (m)
          </label>
          <input
            id="length"
            type="number"
            step="0.001"
            min="0.001"
            max="10"
            value={params.length}
            onChange={handleInputChange('length')}
            className={`antenna-form__input ${errors.length ? 'antenna-form__input--error' : ''}`}
            disabled={isSimulating}
          />
          {errors.length && (
            <span className="antenna-form__error">{errors.length}</span>
          )}
        </div>

        <div className="antenna-form__field">
          <label htmlFor="radius" className="antenna-form__label">
            Wire Radius (m)
          </label>
          <input
            id="radius"
            type="number"
            step="0.0001"
            min="0.0001"
            max="0.1"
            value={params.radius}
            onChange={handleInputChange('radius')}
            className={`antenna-form__input ${errors.radius ? 'antenna-form__input--error' : ''}`}
            disabled={isSimulating}
          />
          {errors.radius && (
            <span className="antenna-form__error">{errors.radius}</span>
          )}
        </div>

        <div className="antenna-form__field">
          <label htmlFor="frequency" className="antenna-form__label">
            Frequency (Hz)
          </label>
          <input
            id="frequency"
            type="number"
            step="1000000"
            min="1000000"
            max="100000000000"
            value={params.frequency}
            onChange={handleInputChange('frequency')}
            className={`antenna-form__input ${errors.frequency ? 'antenna-form__input--error' : ''}`}
            disabled={isSimulating}
          />
          <div className="antenna-form__frequency-display">
            {formatFrequencyDisplay(params.frequency)}
          </div>
          {errors.frequency && (
            <span className="antenna-form__error">{errors.frequency}</span>
          )}
        </div>

        <div className="antenna-form__field">
          <label htmlFor="segments" className="antenna-form__label">
            Segments (odd number)
          </label>
          <input
            id="segments"
            type="number"
            step="2"
            min="3"
            max="1000"
            value={params.segments}
            onChange={handleInputChange('segments')}
            className={`antenna-form__input ${errors.segments ? 'antenna-form__input--error' : ''}`}
            disabled={isSimulating}
          />
          {errors.segments && (
            <span className="antenna-form__error">{errors.segments}</span>
          )}
        </div>
      </div>

      <button 
        type="submit" 
        className="antenna-form__submit"
        disabled={isSimulating || Object.keys(errors).length > 0}
      >
        {isSimulating ? 'Simulating...' : 'Run Simulation'}
      </button>
    </form>
  );
};

export default AntennaForm;
export type { DipoleParams };