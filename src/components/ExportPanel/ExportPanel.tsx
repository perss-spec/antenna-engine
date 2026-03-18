import type { FC } from 'react';
import { useState } from 'react';
import { Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { AntennaParameters } from '@/components/AntennaForm/AntennaForm';
import type { UnifiedSimResults } from '@/lib/unifiedResults';
import type { AntennaPreset, KBEntry } from '@/lib/antennaKB';
import { generatePdfReport } from '@/lib/pdfReportGenerator';
import { captureElementAsImage } from '@/lib/captureCharts';

export interface ExportPanelProps {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  disabled?: boolean;
  className?: string;

  // New props for PDF Generation
  params?: AntennaParameters;
  results?: UnifiedSimResults;
  preset?: AntennaPreset;
  kbEntry?: KBEntry;
  simTimeMs?: number;
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
  params,
  results,
  preset,
  kbEntry,
  simTimeMs = 0,
}) => {
  const { t } = useT();
  const [s1pFormat, setS1pFormat] = useState<S1PFormat>('RI');
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>('MHz');
  const [showSettings, setShowSettings] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

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

  const handleExportPDF = async () => {
    if (!params || !results) return;
    setIsExportingPDF(true);
    
    try {
      // Small delay to ensure any chart animations are done
      await new Promise(r => setTimeout(r, 300));

      const s11 = await captureElementAsImage('chart-s11');
      const vswr = await captureElementAsImage('chart-vswr');
      const zf = await captureElementAsImage('chart-impedance');
      const smith = await captureElementAsImage('chart-smith');
      
      await generatePdfReport(
        params,
        results,
        preset,
        kbEntry,
        { s11, vswr, impedance: zf, smith },
        simTimeMs
      );
    } finally {
      setIsExportingPDF(false);
    }
  };

  const isExportDisabled = disabled || frequencies.length === 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleExportS1P} disabled={isExportDisabled} variant="outline" size="sm" className="flex-1 min-w-[100px]">
          <Download className="h-3 w-3 mr-1.5" />
          {t('export.s1p')}
        </Button>
        <Button onClick={handleExportCSV} disabled={isExportDisabled} variant="outline" size="sm" className="flex-1 min-w-[100px]">
          <Download className="h-3 w-3 mr-1.5" />
          {t('export.csv')}
        </Button>
        <Button onClick={handleExportPDF} disabled={isExportDisabled || isExportingPDF || !params} variant="default" size="sm" className="flex-1 min-w-[100px] bg-accent hover:bg-accent-hover text-white border-0">
          <Download className="h-3 w-3 mr-1.5" />
          {isExportingPDF ? t('export.generating') : t('export.pdf')}
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
        <div className="p-3 border border-border rounded-lg bg-surface space-y-3" style={{ animation: 'fadeIn 0.15s ease-out' }}>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('export.s1pFormat')}</Label>
            <Select
              value={s1pFormat}
              onChange={(e) => setS1pFormat(e.target.value as S1PFormat)}
              size="sm"
              className="w-full"
            >
              <option value="RI">{t('export.ri')}</option>
              <option value="MA">{t('export.ma')}</option>
              <option value="DB">{t('export.dbAngle')}</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('export.freqUnit')}</Label>
            <Select
              value={frequencyUnit}
              onChange={(e) => setFrequencyUnit(e.target.value as FrequencyUnit)}
              size="sm"
              className="w-full"
            >
              <option value="Hz">Hz</option>
              <option value="kHz">kHz</option>
              <option value="MHz">MHz</option>
              <option value="GHz">GHz</option>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPanel;