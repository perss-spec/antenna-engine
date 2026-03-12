import { useState, useCallback } from 'react';
import type { FC, ChangeEvent } from 'react';
import { Settings, Palette, Zap, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  onSettingsChange?: (settings: SettingsData) => void;
  onClose?: () => void;
  className?: string;
}

interface SettingsData {
  general: {
    theme: 'dark' | 'light' | 'auto';
    language: string;
  };
  simulation: {
    defaultFrequencyStart: number;
    defaultFrequencyStop: number;
    meshDensity: number;
  };
  export: {
    format: 'csv' | 'touchstone' | 'json';
    filenameTemplate: string;
  };
}

const defaultSettings: SettingsData = {
  general: {
    theme: 'dark',
    language: 'en'
  },
  simulation: {
    defaultFrequencyStart: 400,
    defaultFrequencyStop: 3000,
    meshDensity: 50
  },
  export: {
    format: 'touchstone',
    filenameTemplate: 'antenna_{date}_{time}'
  }
};

const SettingsPanel: FC<SettingsPanelProps> = ({
  onSettingsChange,
  onClose,
  className
}) => {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = useCallback((section: keyof SettingsData, key: string, value: any) => {
    const newSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  }, [settings]);

  const handleThemeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    updateSettings('general', 'theme', event.target.value as 'dark' | 'light' | 'auto');
  }, [updateSettings]);

  const handleLanguageChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    updateSettings('general', 'language', event.target.value);
  }, [updateSettings]);

  const handleFrequencyStartChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
    updateSettings('simulation', 'defaultFrequencyStart', value);
  }, [updateSettings]);

  const handleFrequencyStopChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
    updateSettings('simulation', 'defaultFrequencyStop', value);
  }, [updateSettings]);

  const handleMeshDensityChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value) || 0;
    updateSettings('simulation', 'meshDensity', value);
  }, [updateSettings]);

  const handleExportFormatChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    updateSettings('export', 'format', event.target.value as 'csv' | 'touchstone' | 'json');
  }, [updateSettings]);

  const handleFilenameTemplateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    updateSettings('export', 'filenameTemplate', event.target.value);
  }, [updateSettings]);

  const handleSave = useCallback(() => {
    onSettingsChange?.(settings);
    setHasChanges(false);
  }, [settings, onSettingsChange]);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(true);
  }, []);

  const getMeshDensityLabel = (value: number): string => {
    if (value < 25) return 'Coarse';
    if (value < 50) return 'Medium';
    if (value < 75) return 'Fine';
    return 'Very Fine';
  };

  const getFormatDescription = (format: string): string => {
    switch (format) {
      case 'csv': return 'Comma-separated values';
      case 'touchstone': return 'Industry standard S-parameter format';
      case 'json': return 'JavaScript Object Notation';
      default: return '';
    }
  };

  return (
    <div className={cn('flex flex-col gap-4 p-4 max-w-2xl', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">Settings</h2>
          {hasChanges && (
            <Badge variant="warning" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        )}
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme">Theme</Label>
            <Select
              id="theme"
              value={settings.general.theme}
              onChange={handleThemeChange}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto (System)</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">Language</Label>
            <Select
              id="language"
              value={settings.general.language}
              onChange={handleLanguageChange}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Simulation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="freq-start">Default Start Frequency (MHz)</Label>
              <Input
                id="freq-start"
                type="number"
                value={settings.simulation.defaultFrequencyStart}
                onChange={handleFrequencyStartChange}
                min={1}
                max={100000}
                step={1}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="freq-stop">Default Stop Frequency (MHz)</Label>
              <Input
                id="freq-stop"
                type="number"
                value={settings.simulation.defaultFrequencyStop}
                onChange={handleFrequencyStopChange}
                min={1}
                max={100000}
                step={1}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="mesh-density">Mesh Density</Label>
              <Badge variant="info" className="text-xs">
                {getMeshDensityLabel(settings.simulation.meshDensity)}
              </Badge>
            </div>
            <Input
              id="mesh-density"
              type="range"
              value={settings.simulation.meshDensity}
              onChange={handleMeshDensityChange}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-text-muted">
              <span>Coarse (10)</span>
              <span>Fine (100)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-format">Default Export Format</Label>
            <Select
              id="export-format"
              value={settings.export.format}
              onChange={handleExportFormatChange}
            >
              <option value="touchstone">Touchstone (.s1p/.s2p)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </Select>
            <p className="text-xs text-text-muted">
              {getFormatDescription(settings.export.format)}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filename-template">Filename Template</Label>
            <Input
              id="filename-template"
              type="text"
              value={settings.export.filenameTemplate}
              onChange={handleFilenameTemplateChange}
              placeholder="antenna_{date}_{time}"
            />
            <p className="text-xs text-text-muted">
              Available variables: {'{date}'}, {'{time}'}, {'{frequency}'}, {'{antenna_type}'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
        
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;