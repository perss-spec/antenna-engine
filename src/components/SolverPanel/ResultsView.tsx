import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Download, Activity, BarChart3, Radar, Zap, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SimulationResults {
  summary: {
    z_input_real: number;
    z_input_imag: number;
    s11_db: number;
    vswr: number;
    gain_dbi: number;
    bandwidth_mhz: number;
    center_freq_mhz: number;
  };
  impedance_data: Array<{
    frequency_mhz: number;
    z_real: number;
    z_imag: number;
  }>;
  s_parameters: Array<{
    frequency_mhz: number;
    s11_magnitude_db: number;
    s11_phase_deg: number;
  }>;
  current_distribution?: Array<{
    element_id: number;
    magnitude: number;
    phase_deg: number;
  }>;
}

interface ResultsViewProps {
  results: SimulationResults;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'impedance' | 'sparameters' | 'pattern' | 'currents'>('summary');

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'impedance', label: 'Impedance', icon: Activity },
    { id: 'sparameters', label: 'S-Parameters', icon: BarChart3 },
    { id: 'pattern', label: 'Pattern', icon: Radar },
    { id: 'currents', label: 'Currents', icon: Zap },
  ] as const;

  const handleExport = async () => {
    try {
      await invoke('export_touchstone_s1p', {
        filename: `antenna_results_${Date.now()}.s1p`
      });
    } catch (error) {
      console.error('Failed to export results:', error);
    }
  };

  const renderSummary = () => (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Input Impedance</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Real Part:</span>
              <span className="font-mono">{results.summary.z_input_real.toFixed(2)} Ω</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Imaginary Part:</span>
              <span className="font-mono">{results.summary.z_input_imag.toFixed(2)} Ω</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Magnitude:</span>
              <span className="font-mono">
                {Math.sqrt(results.summary.z_input_real ** 2 + results.summary.z_input_imag ** 2).toFixed(2)} Ω
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Matching</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">S₁₁:</span>
              <span className="font-mono">{results.summary.s11_db.toFixed(2)} dB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">VSWR:</span>
              <span className="font-mono">{results.summary.vswr.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Radiation</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Peak Gain:</span>
              <span className="font-mono">{results.summary.gain_dbi.toFixed(2)} dBi</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Center Frequency:</span>
              <span className="font-mono">{results.summary.center_freq_mhz.toFixed(1)} MHz</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Bandwidth</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">-10dB BW:</span>
              <span className="font-mono">{results.summary.bandwidth_mhz.toFixed(1)} MHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fractional BW:</span>
              <span className="font-mono">
                {((results.summary.bandwidth_mhz / results.summary.center_freq_mhz) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderImpedance = () => (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={results.impedance_data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="frequency_mhz" 
            label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            label={{ value: 'Impedance (Ω)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} Ω`, name]} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="z_real" 
            stroke="#2563eb" 
            strokeWidth={2}
            name="Real Part"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="z_imag" 
            stroke="#dc2626" 
            strokeWidth={2}
            name="Imaginary Part"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderSParameters = () => (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={results.s_parameters}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="frequency_mhz" 
            label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            label={{ value: 'S₁₁ Magnitude (dB)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} dB`, name]} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="s11_magnitude_db" 
            stroke="#2563eb" 
            strokeWidth={2}
            name="S₁₁ Magnitude"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderPattern = () => (
    <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
      <div className="text-center">
        <Radar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-gray-600 mb-2">Radiation Pattern</h4>
        <p className="text-gray-500 mb-4">3D radiation pattern visualization</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Open Pattern Viewer
        </button>
      </div>
    </div>
  );

  const renderCurrents = () => (
    <div className="space-y-4">
      {results.current_distribution ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Current Distribution</h4>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2">Element</th>
                  <th className="text-left py-2">Magnitude (A/m)</th>
                  <th className="text-left py-2">Phase (°)</th>
                </tr>
              </thead>
              <tbody>
                {results.current_distribution.slice(0, 20).map((current) => (
                  <tr key={current.element_id} className="border-b border-gray-100">
                    <td className="py-1 font-mono">{current.element_id}</td>
                    <td className="py-1 font-mono">{current.magnitude.toExponential(2)}</td>
                    <td className="py-1 font-mono">{current.phase_deg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <div className="text-center">
            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Current distribution not available</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Simulation Results</h3>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export S1P</span>
          </button>
        </div>
        
        <div className="flex space-x-1 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'impedance' && renderImpedance()}
        {activeTab === 'sparameters' && renderSParameters()}
        {activeTab === 'pattern' && renderPattern()}
        {activeTab === 'currents' && renderCurrents()}
      </div>
    </div>
  );
};

export default ResultsView;