import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AntennaForm from './components/AntennaForm/AntennaForm';
import S11Chart from './components/S11Chart/S11Chart';

interface SimulateResponse {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  resonantFreq: number;
  minS11: number;
  bandwidth: number;
}

interface S11DataPoint {
  frequency: number;
  s11_db: number;
}

function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [chartData, setChartData] = useState<S11DataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ resonantFreq: number; minS11: number; bandwidth: number } | null>(null);

  const defaultParams = {
    frequency: 1000,
    length: 150,
    radius: 1,
    height: 0,
    material: 'copper',
  };

  const [params, setParams] = useState(defaultParams);

  const handleSubmit = useCallback(async (formParams: typeof defaultParams) => {
    setIsSimulating(true);
    setError(null);
    setSummary(null);

    try {
      const centerFreqHz = formParams.frequency * 1e6;
      const freqStart = centerFreqHz * 0.5;
      const freqStop = centerFreqHz * 1.5;

      const result = await invoke<SimulateResponse>('simulate_antenna', {
        request: {
          elementType: 'dipole',
          params: {
            length: formParams.length / 1000,
            radius: formParams.radius / 1000,
          },
          freqStart,
          freqStop,
          freqPoints: 101,
        },
      });

      const data: S11DataPoint[] = result.frequencies.map((f, i) => ({
        frequency: f / 1e6,
        s11_db: result.s11Db[i],
      }));

      setChartData(data);
      setSummary({
        resonantFreq: result.resonantFreq,
        minS11: result.minS11,
        bandwidth: result.bandwidth,
      });
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  }, []);

  const formatFreq = (hz: number) => {
    if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
    if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
    return `${(hz / 1e3).toFixed(1)} kHz`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      <h2>AI Antenna Engine</h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 320px' }}>
          <AntennaForm
            parameters={params}
            onParametersChange={setParams}
            onSubmit={handleSubmit}
            isSimulating={isSimulating}
          />
        </div>

        <div style={{ flex: 1, minWidth: '400px' }}>
          {error && (
            <div style={{ color: '#d32f2f', padding: '12px', background: '#fdecea', borderRadius: '4px', marginBottom: '12px' }}>
              {error}
            </div>
          )}

          {summary && (
            <div style={{ padding: '12px', background: '#e8f5e9', borderRadius: '4px', marginBottom: '12px', display: 'flex', gap: '24px' }}>
              <div><strong>Resonant:</strong> {formatFreq(summary.resonantFreq)}</div>
              <div><strong>Min S11:</strong> {summary.minS11.toFixed(1)} dB</div>
              <div><strong>BW (-10dB):</strong> {formatFreq(summary.bandwidth)}</div>
            </div>
          )}

          <S11Chart data={chartData} />
        </div>
      </div>
    </div>
  );
}

export default App;
