import type { FC } from 'react';
import { useState } from 'react';
import { Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ExportPanelProps {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  disabled?: boolean;
  className?: string;
}

type S1PFormat = 'RI' | 'MA' | 'DB';
type FrequencyUnit = 'Hz' | 'kHz' | 'MHz' | 'GHz';

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getFrequencyScale = (unit: FrequencyUnit): number => {
  switch (unit) {
    case 'Hz': return 1;
    case 'kHz': return 1e3;
    case 'MHz': return 1e6;
    case 'GHz': return 1e9;
    default: return 1e6;
  }
};

const convertToMagnitudeAngle = (real: number, imag: number): [number, number] => {
  const magnitude = Math.sqrt(real * real + imag * imag);
  const angle = Math.atan2(imag, real) * 180 / Math.PI;
  return [magnitude, angle];
};

const convertToDbAngle = (real: number, imag: number): [number, number] => {
  const [magnitude, angle] = convertToMagnitudeAngle(real, imag);
  const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -999;
  return [db, angle];
};

const generateS1PContent = (
  frequencies: number[],
  s11Real: number[],
  s11Imag: number[],
  format: S1PFormat,
  freqUnit: FrequencyUnit
): string => {
  const scale = getFrequencyScale(freqUnit);
  const minFreq = Math.min(...frequencies);
  const maxFreq = Math.max(...frequencies);
  const numPoints = frequencies.length;
  
  const header = [
    `! PROMIN Antenna Studio Export`,
    `! Generated: ${new Date().toISOString()}`,
    `! Antenna Type: Generic`,
    `! Frequency Range: ${(minFreq / scale).toFixed(3)} - ${(maxFreq / scale).toFixed(3)} ${freqUnit}`,
    `! Number of Points: ${numPoints}`,
    `! Reference Impedance: 50 Ohm`,
    `# ${freqUnit} S ${format} R 50`
  ].join('\n') + '\n';

  const data = frequencies
    .map((freq, i) => {
      const freqScaled = (freq / scale).toFixed(6);
      const real = s11Real[i] ?? 0;
      const imag = s11Imag[i] ?? 0;
      
      let param1: number, param2: number;
      
      switch (format) {
        case 'RI':
          param1 = real;
          param2 = imag;
          break;
        case 'MA':
          [param1, param2] = convertToMagnitudeAngle(real, imag);
          break;
        case 'DB':
          [param1, param2] = convertToDbAngle(real, imag);
          break;
        default:
          param1 = real;
          param2 = imag;
      }
      
      return `${freqScaled} ${param1.toFixed(8)} ${param2.toFixed(8)}`;
    })
    .join('\n');
    
  return header + data;
};

const generateCSVContent = (
  frequencies: number[],
  s11Db: number[],
  s11Real: number[],
  s11Imag: number[],
  impedanceReal: number[],
  impedanceImag: number[],
  freqUnit: FrequencyUnit
): string => {
  const scale = getFrequencyScale(freqUnit);
  const header = `Frequency (${freqUnit}),S11 (dB),S11 Real,S11 Imag,Impedance Real (Ohm),Impedance Imag (Ohm)\n`;
  const data = frequencies
    .map((freq, i) => {
      const freqScaled = (freq / scale).toFixed(3);
      const db = (s11Db[i] ?? 0).toFixed(3);
      const s_real = (s11Real[i] ?? 0).toFixed(5);
      const s_imag = (s11Imag[i] ?? 0).toFixed(5);
      const z_real = (impedanceReal[i] ?? 0).toFixed(3);
      const z_imag = (impedanceImag[i] ?? 0).toFixed(3);
      return `${freqScaled},${db},${s_real},${s_imag},${z_real},${z_imag}`;
    })
    .join('\n');
  return header + data;
};

const ExportPanel: FC<ExportPanelProps> = ({
  frequencies,
  s11Db,
  s11Real,
  s11Imag,
  impedanceReal,
  impedanceImag,
  disabled = false,
  className,
}) => {
  const [s1pFormat, setS1pFormat] = useState<S1PFormat>('RI');
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>('MHz');
  const [showSettings, setShowSettings] = useState(false);

  const handleExportS1P = () => {
    const content = generateS1PContent(frequencies, s11Real, s11Imag, s1pFormat, frequencyUnit);
    downloadFile(content, `promin_export_${Date.now()}.s1p`, 'application/touchstone');
  };

  const handleExportCSV = () => {
    const content = generateCSVContent(
      frequencies,
      s11Db,
      s11Real,
      s11Imag,
      impedanceReal,
      impedanceImag,
      frequencyUnit
    );
    downloadFile(content, `promin_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  };

  const isExportDisabled = disabled || frequencies.length === 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Button onClick={handleExportS1P} disabled={isExportDisabled} variant="outline" size="sm" className="flex-1">
          <Download className="h-3 w-3 mr-1.5" />
          Export S1P
        </Button>
        <Button onClick={handleExportCSV} disabled={isExportDisabled} variant="outline" size="sm" className="flex-1">
          <Download className="h-3 w-3 mr-1.5" />
          Export CSV
        </Button>
        <Button 
          onClick={() => setShowSettings(!showSettings)} 
          variant="outline" 
          size="sm"
          className="px-2"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>
      
      {showSettings && (
        <div className="p-3 border rounded-md bg-muted/50 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium">S1P Format:</label>
            <select 
              value={s1pFormat} 
              onChange={(e) => setS1pFormat(e.target.value as S1PFormat)}
              className="w-full px-2 py-1 text-xs border rounded"
            >
              <option value="RI">Real/Imaginary</option>
              <option value="MA">Magnitude/Angle</option>
              <option value="DB">dB/Angle</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium">Frequency Unit:</label>
            <select 
              value={frequencyUnit} 
              onChange={(e) => setFrequencyUnit(e.target.value as FrequencyUnit)}
              className="w-full px-2 py-1 text-xs border rounded"
            >
              <option value="Hz">Hz</option>
              <option value="kHz">kHz</option>
              <option value="MHz">MHz</option>
              <option value="GHz">GHz</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPanel;