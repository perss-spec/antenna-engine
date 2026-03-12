import React, { useState } from 'react';

interface AntennaControlsProps {}

const AntennaControls: React.FC<AntennaControlsProps> = () => {
  const [length, setLength] = useState<number>(0);
  const [frequency, setFrequency] = useState<number>(0);

  const handleCalculate = () => {
    // TODO: Implement calculation logic
    console.log('Calculate clicked', { length, frequency });
  };

  return (
    <div className="antenna-controls">
      <div className="form-group">
        <label htmlFor="length-input">Length:</label>
        <input
          id="length-input"
          type="number"
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          placeholder="Enter length"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="frequency-input">Frequency:</label>
        <input
          id="frequency-input"
          type="number"
          value={frequency}
          onChange={(e) => setFrequency(Number(e.target.value))}
          placeholder="Enter frequency"
        />
      </div>
      
      <button 
        type="button" 
        onClick={handleCalculate}
        className="calculate-button"
      >
        Calculate
      </button>
    </div>
  );
};

export default AntennaControls;