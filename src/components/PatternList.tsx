import React, { useState, useEffect } from 'react';
import type { AntennaPattern } from '../types/antenna';
import { listPatterns, deletePattern } from '../lib/tauri';

interface PatternListProps {
  selectedPatternId?: string | null;
  onPatternSelect: (pattern: AntennaPattern) => void;
  onPatternDelete?: (patternId: string) => void;
  className?: string;
}

export const PatternList: React.FC<PatternListProps> = ({
  selectedPatternId,
  onPatternSelect,
  onPatternDelete,
  className = ''
}) => {
  const [patterns, setPatterns] = useState<AntennaPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadPatterns = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listPatterns();
      if (response.success && response.data) {
        setPatterns(response.data);
      } else {
        setError(response.error || 'Failed to load patterns');
      }
    } catch (err) {
      setError(`Error loading patterns: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, []);

  const handleDeletePattern = async (patternId: string, patternName: string) => {
    if (!confirm(`Delete pattern "${patternName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(patternId));

    try {
      const response = await deletePattern(patternId);
      if (response.success) {
        setPatterns(prev => prev.filter(p => p.id !== patternId));
        onPatternDelete?.(patternId);
      } else {
        alert(`Failed to delete pattern: ${response.error}`);
      }
    } catch (err) {
      alert(`Error deleting pattern: ${err}`);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(patternId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadPatterns}
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Antenna Patterns</h3>
          <button
            onClick={loadPatterns}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {patterns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No patterns found</p>
            <p className="text-sm text-gray-400 mt-2">
              Create a new pattern or import existing data
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedPatternId === pattern.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                }`}
                onClick={() => onPatternSelect(pattern)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{pattern.name}</h4>
                    <div className="mt-1 text-sm text-gray-600 space-y-1">
                      <div>Frequency: {pattern.frequency.toFixed(1)} MHz</div>
                      <div>Gain: {pattern.gain.toFixed(1)} dBi</div>
                      <div>Beamwidth: {pattern.beamwidth.toFixed(1)}°</div>
                      <div>Polarization: {pattern.polarization}</div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Created: {new Date(pattern.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPatternSelect(pattern);
                      }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePattern(pattern.id, pattern.name);
                      }}
                      disabled={deletingIds.has(pattern.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      {deletingIds.has(pattern.id) ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};