import { useMemo } from 'react';
import type { AntennaGeometry } from '../../types/antenna';
import { WireElement } from './elements/WireElement';
import { PatchElement } from './elements/PatchElement';
import { QFHElement } from './elements/QFHElement';

export interface AntennaRendererProps {
  geometry: AntennaGeometry;
  selectedElementId: string | null;
  onElementSelect: (id: string | null) => void;
  showWireframe?: boolean;
}

export function AntennaRenderer({
  geometry,
  selectedElementId,
  onElementSelect,
  showWireframe = false
}: AntennaRendererProps) {
  const elementComponents = useMemo(() => {
    return geometry.elements.map((element) => {
      const isSelected = selectedElementId === element.id;
      const handleClick = () => {
        onElementSelect(isSelected ? null : element.id);
      };

      switch (element.type) {
        case 'wire':
          return (
            <WireElement
              key={element.id}
              element={element}
              selected={isSelected}
              showWireframe={showWireframe}
              onClick={handleClick}
            />
          );
        case 'patch':
          return (
            <PatchElement
              key={element.id}
              element={element}
              selected={isSelected}
              showWireframe={showWireframe}
              onClick={handleClick}
            />
          );
        case 'qfh':
          return (
            <QFHElement
              key={element.id}
              element={element}
              selected={isSelected}
              showWireframe={showWireframe}
              onClick={handleClick}
            />
          );
        default:
          return null;
      }
    });
  }, [geometry.elements, selectedElementId, onElementSelect, showWireframe]);

  return <group>{elementComponents}</group>;
}