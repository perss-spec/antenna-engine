import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';

interface OptimizationResult {
  iteration: number;
  frequency: number;
  length: number;
  radius: number;
  s11: number;
  timestamp: Date;
}

interface OptimizationPanelProps {
  onStartOptimization?: (params: OptimizationParams) => void;
  onStopOptimization?: () => void;
  isOptimizing?: boolean;
  progress?: number;
  results?: OptimizationResult[];
  className?: string;
}

interface OptimizationParams {
  targetFrequency: number;
  targetS11: number;
  method: 'gradient' | 'random' | 'bayesian';
}

const OptimizationPanel: FC<OptimizationPanelProps> = ({
  onStartOptimization,
  onStopOptimization,
  isOptimizing = false,
  progress = 0,
  results = [],
  className = ''
}) => {
  const [targetFrequency, setTargetFrequency] = useState<number>(2400); // MHz
  const [targetS11, setTargetS11] = useState<number>(-20); // dB
  const [method, setMethod] = useState<'gradient' | 'random' | 'bayesian'>('gradient');

  const handleStartOptimization = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (onStartOptimization && !isOptimizing) {
      onStartOptimization({
        targetFrequency,
        targetS11,
        method
      });
    }
  }, [targetFrequency, targetS11, method, onStartOptimization, isOptimizing]);

  const handleStopOptimization = useCallback(() => {
    if (onStopOptimization && isOptimizing) {
      onStopOptimization();
    }
  }, [onStopOptimization, isOptimizing]);

  const handleFrequencyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTargetFrequency(parseFloat(e.target.value) || 0);
  }, []);

  const handleS11Change = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTargetS11(parseFloat(e.target.value) || 0);
  }, []);

  const handleMethodChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setMethod(e.target.value as 'gradient' | 'random' | 'bayesian');
  }, []);

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(2)} GHz`;
    }
    return `${freq} MHz`;
  };

  const formatS11 = (s11: number): string => {
    return `${s11.toFixed(2)} dB`;
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  const getBestResult = (): OptimizationResult | null => {
    if (results.length === 0) return null;
    return results.reduce((best, current) => 
      current.s11 < best.s11 ? current : best
    );
  };

  const bestResult = getBestResult();

  return (
    <div 
      className={className}
      style={{
        background: '#12121a',
        border: '1px solid #1e1e2e',
        borderRadius: '8px',
        padding: '20px',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#ffffff'
        }}>
          Antenna Optimization
        </h3>
        
        <form onSubmit={handleStartOptimization} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label 
                htmlFor="target-frequency"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#e5e7eb'
                }}
              >
                Target Frequency (MHz)
              </label>
              <input
                id="target-frequency"
                type="number"
                value={targetFrequency}
                onChange={handleFrequencyChange}
                min="100"
                max="10000"
                step="1"
                disabled={isOptimizing}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1e1e2e',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  ...(isOptimizing && {
                    opacity: '0.6',
                    cursor: 'not-allowed'
                  })
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#374151';
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="target-s11"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#e5e7eb'
                }}
              >
                Target S11 (dB)
              </label>
              <input
                id="target-s11"
                type="number"
                value={targetS11}
                onChange={handleS11Change}
                min="-60"
                max="0"
                step="0.1"
                disabled={isOptimizing}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1e1e2e',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  ...(isOptimizing && {
                    opacity: '0.6',
                    cursor: 'not-allowed'
                  })
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#374151';
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="optimization-method"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#e5e7eb'
                }}
              >
                Optimization Method
              </label>
              <select
                id="optimization-method"
                value={method}
                onChange={handleMethodChange}
                disabled={isOptimizing}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1e1e2e',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: isOptimizing ? 'not-allowed' : 'pointer',
                  ...(isOptimizing && {
                    opacity: '0.6'
                  })
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#374151';
                }}
              >
                <option value="gradient">Gradient Descent</option>
                <option value="random">Random Search</option>
                <option value="bayesian">Bayesian Optimization</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {!isOptimizing ? (
              <button
                type="submit"
                style={{
                  background: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5855eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#6366f1';
                }}
              >
                Start Optimization
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopOptimization}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                Stop Optimization
              </button>
            )}

            {isOptimizing && (
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>Progress</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' }}>
                    {progress.toFixed(1)}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: '#6366f1',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {bestResult && (
        <div style={{
          background: '#1e1e2e',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#10b981'
          }}>
            Best Result
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            fontSize: '14px'
          }}>
            <div>
              <span style={{ color: '#9ca3af' }}>Frequency: </span>
              <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                {formatFrequency(bestResult.frequency)}
              </span>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>S11: </span>
              <span style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: '600' }}>
                {formatS11(bestResult.s11)}
              </span>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>Length: </span>
              <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                {bestResult.length.toFixed(3)}m
              </span>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>Radius: </span>
              <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                {(bestResult.radius * 1000).toFixed(2)}mm
              </span>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#ffffff'
          }}>
            Optimization Results ({results.length} iterations)
          </h4>
          
          <div style={{
            background: '#1e1e2e',
            border: '1px solid #374151',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
              }}>
                <thead>
                  <tr style={{ background: '#374151' }}>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #4b5563'
                    }}>
                      #
                    </th>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #4b5563'
                    }}>
                      Frequency
                    </th>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #4b5563'
                    }}>
                      Length (m)
                    </th>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #4b5563'
                    }}>
                      Radius (mm)
                    </th>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #4b5563'
                    }}>
                      S11 (dB)
                    </th>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #4b5563'
                    }}>
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice().reverse().map((result, index) => {
                    const isBest = result === bestResult;
                    return (
                      <tr 
                        key={result.iteration}
                        style={{
                          background: isBest ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          borderBottom: index < results.length - 1 ? '1px solid #374151' : 'none'
                        }}
                      >
                        <td style={{
                          padding: '8px 12px',
                          color: '#9ca3af',
                          fontFamily: 'monospace'
                        }}>
                          {result.iteration}
                        </td>
                        <td style={{
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontFamily: 'monospace'
                        }}>
                          {formatFrequency(result.frequency)}
                        </td>
                        <td style={{
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontFamily: 'monospace'
                        }}>
                          {result.length.toFixed(4)}
                        </td>
                        <td style={{
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontFamily: 'monospace'
                        }}>
                          {(result.radius * 1000).toFixed(3)}
                        </td>
                        <td style={{
                          padding: '8px 12px',
                          color: isBest ? '#10b981' : (result.s11 < targetS11 ? '#10b981' : '#ffffff'),
                          fontFamily: 'monospace',
                          fontWeight: isBest ? '600' : '400'
                        }}>
                          {formatS11(result.s11)}
                        </td>
                        <td style={{
                          padding: '8px 12px',
                          color: '#9ca3af',
                          fontFamily: 'monospace'
                        }}>
                          {formatTimestamp(result.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationPanel;