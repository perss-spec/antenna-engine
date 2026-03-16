import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Download, BarChart3, Zap, Radio, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SimulationResults {
  summary: {
    z_input: { real: number; imag: number }; // Input impedance at center freq
    s11_db: number; // S11 in dB at center freq
    vswr: number;
    gain_dbi: number; // Peak gain
    bandwidth_mhz: number; // -10dB bandwidth
    efficiency_percent: number;
  };
  frequency_data: {
    frequency_mhz: number;
    z_real: number;
    z_imag: number;
    s11_magnitude: number;
    s11_phase: number;
    s11_db: number;
  }[];
  pattern_available: boolean;
  current_distribution_available: boolean;
}

interface ResultsViewProps {
  isVisible: boolean;
}

const ResultsView: React.FC<ResultsViewProps> = ({ isVisible }) => {
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'impedance' | 'sparameters' | 'pattern' | 'currents'>('summary');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadResults();
    }
  }, [isVisible]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await invoke<SimulationResults>('get_simulation_results');
      setResults(data);
    } catch (error) {
      console.error('Failed to load simulation results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTouchstone = async () => {
    try {
      await invoke('export_touchstone_s1p');
      // Could show success toast here
    } catch (error) {
      console.error('Failed to export Touchstone file:', error);
    }
  };

  const formatComplex = (real: number, imag: number): string => {
    const sign = imag >= 0 ? '+' : '-';
    return `${real.toFixed(1)} ${sign} j${Math.abs(imag).toFixed(1)}`;
  };

  if (!isVisible || !results) {
    return isVisible ? (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="text-center py-8">
          {loading ? 'Loading results...' : 'No results available'}
        </div>
      </div>
    ) : null;
  }

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'impedance', label: 'Impedance', icon: Zap },
    { id: 'sparameters', label: 'S-Parameters', icon: Activity },
    { id: 'pattern', label: 'Pattern', icon: Radio, disabled: !results.pattern_available },
    { id: 'currents', label: 'Currents', icon: Activity, disabled: !results.current_distribution_available }
  ] as const;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Simulation Results</h3>
        <button
          onClick={handleExportTouchstone}
          className="flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          <Download className="w-4 h-4 mr-1" />
          Export S1P
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : tab.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'summary' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium text-gray-900 mb-2">Input Impedance</h4>
                <div className="text-lg font-mono">
                  {formatComplex(results.summary.z_input.real, results.summary.z_input.imag)} Ω
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium text-gray-900 mb-2">Return Loss (S11)</h4>
                <div className="text-lg font-mono">
                  {results.summary.s11_db.toFixed(1)} dB
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium text-gray-900 mb-2">VSWR</h4>
                <div className="text-lg font-mono">
                  {results.summary.vswr.toFixed(2)}:1
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium text-gray-900 mb-2">Peak Gain</h4>
                <div className="text-lg font-mono">
                  {results.summary.gain_dbi.toFixed(1)} dBi
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium text-gray-900 mb-2">-10dB Bandwidth</h4>
                <div className="text-lg font-mono">
                  {results.summary.bandwidth_mhz.toFixed(1)} MHz
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium text-gray-900 mb-2">Efficiency</h4>
                <div className="text-lg font-mono">
                  {results.summary.efficiency_percent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'impedance' && (
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Input Impedance vs Frequency</h4>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.frequency_data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="frequency_mhz"
                    label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Impedance (Ω)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      `${(value as number).toFixed(1)} Ω`,
                      name === 'z_real' ? 'Resistance' : 'Reactance'
                    ]}
                  />
                  <ReferenceLine y={50} stroke="#888" strokeDasharray="5 5" label="50Ω" />
                  <Line 
                    type="monotone" 
                    dataKey="z_real" 
                    stroke="#2563eb" 
                    name="Resistance"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="z_imag" 
                    stroke="#dc2626" 
                    name="Reactance"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'sparameters' && (
          <div>
            <h4 className="font-medium text-gray-900 mb-4">S11 Parameter</h4>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.frequency_data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="frequency_mhz"
                    label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${(value as number).toFixed(1)} dB`, 'S11 Magnitude']}
                  />
                  <ReferenceLine y={-10} stroke="#888" strokeDasharray="5 5" label="-10dB" />
                  <Line 
                    type="monotone" 
                    dataKey="s11_db" 
                    stroke="#2563eb" 
                    name="S11"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'pattern' && (
          <div className="text-center py-12">
            <Radio className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Radiation Pattern</h4>
            <p className="text-gray-600 mb-4">
              3D radiation pattern visualization will be displayed here.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Open Pattern Viewer
            </button>
          </div>
        )}

        {activeTab === 'currents' && (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Current Distribution</h4>
            <p className="text-gray-600 mb-4">
              Surface current distribution on the antenna mesh.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              View Current Distribution
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsView;