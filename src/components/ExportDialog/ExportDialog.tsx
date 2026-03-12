import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Download, FileText, Database, Radio } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExportDialogProps {
  onExport?: (config: ExportConfig) => void;
  onCancel?: () => void;
  defaultFrequencyStart?: number;
  defaultFrequencyStop?: number;
  isExporting?: boolean;
  className?: string;
}

interface ExportConfig {
  format: 'csv' | 'json' | 'touchstone';
  filename: string;
  frequencyStart: number;
  frequencyStop: number;
  includeHeader: boolean;
}

const ExportDialog: FC<ExportDialogProps> = ({
  onExport,
  onCancel,
  defaultFrequencyStart = 400,
  defaultFrequencyStop = 3000,
  isExporting = false,
  className
}) => {
  const [format, setFormat] = useState<'csv' | 'json' | 'touchstone'>('touchstone');
  const [filename, setFilename] = useState<string>(generateDefaultFilename('touchstone'));
  const [frequencyStart, setFrequencyStart] = useState<number>(defaultFrequencyStart);
  const [frequencyStop, setFrequencyStop] = useState<number>(defaultFrequencyStop);
  const [includeHeader, setIncludeHeader] = useState<boolean>(true);

  function generateDefaultFilename(format: 'csv' | 'json' | 'touchstone'): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    
    const extensions = {
      csv: 'csv',
      json: 'json',
      touchstone: 's1p'
    };
    
    return `antenna_${date}_${time}.${extensions[format]}`;
  }

  const handleFormatChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newFormat = event.target.value as 'csv' | 'json' | 'touchstone';
    setFormat(newFormat);
    setFilename(generateDefaultFilename(newFormat));
  }, []);

  const handleFilenameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFilename(event.target.value);
  }, []);

  const handleFrequencyStartChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
    setFrequencyStart(value);
  }, []);

  const handleFrequencyStopChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
    setFrequencyStop(value);
  }, []);

  const handleIncludeHeaderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setIncludeHeader(event.target.checked);
  }, []);

  const handleExport = useCallback((event: FormEvent) => {
    event.preventDefault();
    
    if (!filename.trim()) {
      return;
    }
    
    if (frequencyStart >= frequencyStop) {
      return;
    }
    
    const config: ExportConfig = {
      format,
      filename: filename.trim(),
      frequencyStart,
      frequencyStop,
      includeHeader
    };
    
    onExport?.(config);
  }, [format, filename, frequencyStart, frequencyStop, includeHeader, onExport]);

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'csv': return <FileText className="w-4 h-4" />;
      case 'json': return <Database className="w-4 h-4" />;
      case 'touchstone': return <Radio className="w-4 h-4" />;
      default: return <Download className="w-4 h-4" />;
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'csv': return 'Comma-separated values for spreadsheet applications';
      case 'json': return 'JavaScript Object Notation for web applications';
      case 'touchstone': return 'Standard S-parameter format for RF tools';
      default: return '';
    }
  };

  const isFormValid = filename.trim().length > 0 && frequencyStart < frequencyStop;

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Antenna Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleExport} className="flex flex-col gap-4">
          {/* Format Selection */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="format">Export Format</Label>
            <Select
              id="format"
              value={format}
              onChange={handleFormatChange}
              disabled={isExporting}
            >
              <option value="touchstone">Touchstone (.s1p)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </Select>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
              {getFormatIcon(format)}
              <span>{getFormatDescription(format)}</span>
            </div>
          </div>

          {/* Filename Input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filename">Filename</Label>
            <Input
              id="filename"
              type="text"
              value={filename}
              onChange={handleFilenameChange}
              placeholder="Enter filename..."
              disabled={isExporting}
              required
            />
          </div>

          {/* Frequency Range Override */}
          <div className="flex flex-col gap-2">
            <Label>Frequency Range (MHz)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="freq-start" className="text-xs">Start</Label>
                <Input
                  id="freq-start"
                  type="number"
                  value={frequencyStart}
                  onChange={handleFrequencyStartChange}
                  min={1}
                  max={10000}
                  step={0.1}
                  disabled={isExporting}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="freq-stop" className="text-xs">Stop</Label>
                <Input
                  id="freq-stop"
                  type="number"
                  value={frequencyStop}
                  onChange={handleFrequencyStopChange}
                  min={1}
                  max={10000}
                  step={0.1}
                  disabled={isExporting}
                  required
                />
              </div>
            </div>
            {frequencyStart >= frequencyStop && (
              <p className="text-xs text-error">Start frequency must be less than stop frequency</p>
            )}
          </div>

          {/* Include Header Checkbox */}
          <div className="flex items-center gap-2">
            <input
              id="include-header"
              type="checkbox"
              checked={includeHeader}
              onChange={handleIncludeHeaderChange}
              disabled={isExporting}
              className="w-4 h-4 rounded border border-border bg-surface-hover text-accent focus:ring-1 focus:ring-accent"
            />
            <Label htmlFor="include-header" className="text-sm cursor-pointer">
              Include header information
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isExporting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isExporting}
              className="flex-1 flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ExportDialog;
export type { ExportDialogProps, ExportConfig };