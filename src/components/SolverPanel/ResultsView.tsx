import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Radio, 
  Download,
  ExternalLink
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface SimulationResults {
  summary: {
    z_in_real: number;
    z_in_imag: number;
    s11_db: number;
    vswr: number;
    gain_dbi: number;
    bandwidth_mhz: number;
    efficiency_percent: number;
  };
  impedance_data: Array<{
    frequency_ghz: number;
    z_real: number;
    z_imag: number;
  }>;
  s_parameters: Array<{
    frequency_ghz: number;
    s11_mag_db: number;
    s11_phase_deg: number;
  }>;
  has_pattern_data: boolean;
  has_current_data: boolean;
}

interface ResultsViewProps {
  isVisible: boolean;
  onOpenPatternView: () => void;
}

type TabType = 'summary' | 'impedance' | 'sparameters' | 'pattern' | 'currents';

export const ResultsView: React.FC<ResultsViewProps> = ({
  isVisible,
  onOpenPatternView
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadResults();
    }
  }, [isVisible]);

  const loadResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<SimulationResults>('get_simulation_results');
      setResults(data);
    } catch (err) {
      setError('Failed to load simulation results');
      console.error('Error loading results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTouchstone = async () => {
    try {
      await invoke('export_touchstone_s1p');
    } catch (err) {
      console.error('Failed to export Touchstone file:', err);
    }
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'impedance', label: 'Impedance', icon: Zap },
    { id: 'sparameters', label: 'S-Parameters', icon: TrendingUp },
    { id: 'pattern', label: 'Pattern', icon: Radio },
    { id: 'currents', label: 'Currents', icon: Zap }
  ] as const;

  if (!isVisible) return null;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading results...</span>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-red-600">
          {error || 'No results available'}
        </div>
      </div>
    );
  }

  const renderSummaryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-blue-700">Input Impedance</div>
          <div className="text-2xl font-bold text-blue-900">
            {results.summary.z_in_real.toFixed(1)} {results.summary.z_in_imag >= 0 ? '+' : ''}
            {results.summary.z_in_imag.toFixed(1)}j Ω
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm font-medium text-green-700">S11</div>
          <div className="text-2xl font-bold text-green-900">
            {results.summary.s11_db.toFixed(1)} dB
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="text-sm font-medium text-purple-700">VSWR</div>
          <div className="text-2xl font-bold text-purple-900">
            {results.summary.vswr.toFixed(2)}:1
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-sm font-medium text-orange-700">Gain</div>
          <div className="text-2xl font-bold text-orange-900">
            {results.summary.gain_dbi.toFixed(1)} dBi
          </div>
        </div>
        
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
          <div className="text-sm font-medium text-indigo-700">Bandwidth</div>
          <div className="text-2xl font-bold text-indigo-900">
            {results.summary.bandwidth_mhz.toFixed(0)} MHz
          </div>
        </div>
        
        <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
          <div className="text-sm font-medium text-teal-700">Efficiency</div>
          <div className="text-2xl font-bold text-teal-900">
            {results.summary.efficiency_percent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );

  const renderImpedanceTab = () => (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-gray-900">Impedance vs Frequency</h4>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={results.impedance_data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="frequency_ghz" 
              label={{ value: 'Frequency (GHz)', position: 'insideBottom', offset: -10 }}
            />
            <YAxis label={{ value: 'Impedance (Ω)', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)} Ω`, 
                name === 'z_real' ? 'Resistance' : 'Reactance'
              ]}
              labelFormatter={(label) => `Frequency: ${label} GHz`}
            />
            <Line 
              type="monotone" 
              dataKey="z_real" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={false}
              name="z_real"
            />
            <Line 
              type="monotone" 
              dataKey="z_imag" 
              stroke="#EF4444" 
              strokeWidth={2}
              dot={false}
              name="z_imag"
            />
            <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="2 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderSParametersTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">S11 Magnitude</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.s_parameters}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="frequency_ghz"
                  label={{ value: 'Frequency (GHz)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)} dB`, 'S11']}
                  labelFormatter={(label) => `Frequency: ${label} GHz`}
                />
                <Line 
                  type="monotone" 
                  dataKey="s11_mag_db" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine y={-10} stroke="#6B7280" strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">S11 Phase</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.s_parameters}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="frequency_ghz"
                  label={{ value: 'Frequency (GHz)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis label={{ value: 'Phase (deg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}°`, 'Phase']}
                  labelFormatter={(label) => `Frequency: ${label} GHz`}
                />
                <Line 
                  type="monotone" 
                  dataKey="s11_phase_deg" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPatternTab = () => (
    <div className="text-center py-12 space-y-4">
      <Radio className="h-16 w-16 mx-auto text-gray-400" />
      <h4 className="text-lg font-medium text-gray-900">Radiation Pattern</h4>
      <p className="text-gray-600 max-w-md mx-auto">
        View the 3D radiation pattern and analyze antenna directivity, gain, and beam characteristics.
      </p>
      <button
        onClick={onOpenPatternView}
        disabled={!results.has_pattern_data}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        Open Pattern View
      </button>
      {!results.has_pattern_data && (
        <p className="text-sm text-red-600">Pattern data not available</p>
      )}
    </div>
  );

  const renderCurrentsTab = () => (
    <div className="text-center py-12 space-y-4">
      <Zap className="h-16 w-16 mx-auto text-gray-400" />
      <h4 className="text-lg font-medium text-gray-900">Current Distribution</h4>
      <p className="text-gray-600 max-w-md mx-auto">
        Current distribution visualization will be displayed here when available.
      </p>
      {!results.has_current_data && (
        <p className="text-sm text-red-600">Current data not available</p>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary': return renderSummaryTab();
      case 'impedance': return renderImpedanceTab();
      case 'sparameters': return renderSParametersTab();
      case 'pattern': return renderPatternTab();
      case 'currents': return renderCurrentsTab();
      default: return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Simulation Results</h3>
          <button
            onClick={handleExportTouchstone}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export S1P
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
};