import { useMemo } from 'react';
import { getCategoryForId } from '@/lib/antennaKB';
import { WireSchematic } from './schematics/WireSchematic';
import { PatchSchematic } from './schematics/PatchSchematic';
import { HornSchematic } from './schematics/HornSchematic';
import { BroadbandSchematic } from './schematics/BroadbandSchematic';
import { SpiralSchematic } from './schematics/SpiralSchematic';
import { SlotSchematic } from './schematics/SlotSchematic';
import { ArraySchematic } from './schematics/ArraySchematic';
import { SpecialSchematic } from './schematics/SpecialSchematic';

interface AntennaPreviewProps {
  antennaType: string;
  params: Record<string, number>;
  frequency: number; // Hz
}

export function AntennaPreview({ antennaType, params, frequency }: AntennaPreviewProps) {
  const category = getCategoryForId(antennaType);

  const schematic = useMemo(() => {
    const props = { params, frequency, antennaType };

    switch (category) {
      case 'wire':
        return <WireSchematic {...props} />;
      case 'microstrip':
        return <PatchSchematic {...props} />;
      case 'broadband':
        if (antennaType === 'archimedean_spiral')
          return <SpiralSchematic params={params} frequency={frequency} />;
        return <BroadbandSchematic {...props} />;
      case 'aperture':
        if (antennaType === 'rectangular_slot' || antennaType === 'parabolic_reflector')
          return <SlotSchematic {...props} />;
        return <HornSchematic {...props} />;
      case 'array':
        return <ArraySchematic {...props} />;
      case 'special':
        return <SpecialSchematic {...props} />;
      default:
        return <WireSchematic {...props} />;
    }
  }, [category, antennaType, params, frequency]);

  return (
    <div className="w-full bg-base/50 border border-border/30 rounded-xl overflow-hidden" style={{ height: 200 }}>
      {schematic}
    </div>
  );
}
