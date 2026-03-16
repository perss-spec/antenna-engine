import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';

interface SimulationResults {
  summary: {
    z_input_ohm: { real: number; imag: number };
    s11_db: number;
    vswr: number;
    gain_dbi: number;
    bandwidth_mhz: number;
  };
  impedance_data: Array<{
    frequency_mhz: number;
    z_real: number;
    z_imag: number;
  }>;
  s_parameters: Array<{
    frequency_mhz: number;
    s11_magnitude: number;
    s11_phase_deg: number;
  }>;
  current_distribution?: Array<{
    element_id: number;
    current_magnitude: number;
    current_phase: number;
  }>;
}

interface ResultsViewProps {
  onClose: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ onClose }) => {
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'impedance' | 's-parameters' | 'pattern' | 'currents'>('summary');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const data = await invoke<SimulationResults>('get_simulation_results');
        setResults(data);
      } catch (error) {
        console.error('Failed to load simulation results:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, []);

  const handleExport = async () => {
    if (!results) return;

    try {
      const filePath = await save({
        filters: [{
          name: 'Touchstone',
          extensions: ['s1p']
        }]
      });

      if (filePath) {
        // Generate S1P content
        let content = '! Touchstone file exported from PROMIN Antenna Studio\n';
        content += '# MHz S RI R 50\n';
        
        results.s_parameters.forEach(point => {
          const s11_real = point.s11_magnitude * Math.cos(point.s11_phase_deg * Math.PI / 180);
          const s11_imag = point.s11_magnitude * Math.sin(point.s11_phase_deg * Math.PI / 180);
          content += `${point.frequency_mhz} ${s11_real.toExponential(6)} ${s11_imag.toExponential(6)}\n`;
        });

        await writeTextFile(filePath, content);
      }
    } catch (error) {
      console.error('Failed to export results:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading results...</span>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">
          Failed to load simulation results
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'impedance', label: 'Impedance' },
    { id: 's-parameters', label: 'S-Parameters' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'currents', label: 'Currents' }
  ];

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Simulation Results</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export S1P
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'summary' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Input Impedance</h4>
              <div className="text-2xl font-bold text-blue-600">
                {results.summary.z_input_ohm.real.toFixed(1)} + j{results.summary.z_input_ohm.imag.toFixed(1)} Ω
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">S11</h4>
              <div className="text-2xl font-bold text-blue-600">
                {results.summary.s11_db.toFixed(2)} dB
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">VSWR</h4>
              <div className="text-2xl font-bold text-blue-600">
                {results.summary.vswr.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Gain</h4>
              <div className="text-2xl font-bold text-blue-600">
                {results.summary.gain_dbi.toFixed(1)} dBi
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Bandwidth</h4>
              <div className="text-2xl font-bold text-blue-600">
                {results.summary.bandwidth_mhz.toFixed(1)} MHz
              </div>
            </div>
          </div>
        )}

        {activeTab === 'impedance' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Impedance vs Frequency</h4>
            <div className="bg-gray-50 rounded-lg p-4 h-64 flex items-center justify-center">
              <span className="text-gray-600">Impedance plot will be rendered here</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency (MHz)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Real (Ω)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Imaginary (Ω)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.impedance_data.slice(0, 10).map((point, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {point.frequency_mhz.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {point.z_real.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {point.z_imag.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 's-parameters' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">S11 Parameters</h4>
            <div className="bg-gray-50 rounded-lg p-4 h-64 flex items-center justify-center">
              <span className="text-gray-600">S11 magnitude and phase plot will be rendered here</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency (MHz)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      |S11| (dB)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phase (°)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.s_parameters.slice(0, 10).map((point, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {point.frequency_mhz.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(20 * Math.log10(point.s11_magnitude)).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {point.s11_phase_deg.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'pattern' && (
          <div className="text-center py-8">
            <div className="text-gray-600 mb-4">
              Radiation pattern visualization will be available in the Pattern tab
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Open Radiation Pattern
            </button>
          </div>
        )}

        {activeTab === 'currents' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Current Distribution</h4>
            {results.current_distribution ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Element ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Magnitude (A)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phase (°)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.current_distribution.slice(0, 20).map((current, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {current.element_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {current.current_magnitude.toExponential(3)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {current.current_phase.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                Current distribution data not available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsView;