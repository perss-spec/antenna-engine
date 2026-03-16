// @ts-nocheck
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SimulationParams {
  frequency: number;
  meshSize: number;
  material: string;
  antennaType: string;
}

interface SimulationSetupProps {
  onRunSimulation: (params: SimulationParams) => void;
  isSimulating: boolean;
}

export const SimulationSetup: React.FC<SimulationSetupProps> = ({ onRunSimulation, isSimulating }) => {
  const [frequency, setFrequency] = useState<number>(2400);
  const [meshSize, setMeshSize] = useState<number>(0.1);
  const [material, setMaterial] = useState<string>('copper');
  const [antennaType, setAntennaType] = useState<string>('patch');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: SimulationParams = {
      frequency,
      meshSize,
      material,
      antennaType
    };
    onRunSimulation(params);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulation Parameters</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency (MHz)</Label>
              <Input
                id="frequency"
                type="number"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                min={1}
                max={10000}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="meshSize">Mesh Size (mm)</Label>
              <Input
                id="meshSize"
                type="number"
                step={0.01}
                value={meshSize}
                onChange={(e) => setMeshSize(Number(e.target.value))}
                min={0.01}
                max={10}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Antenna Type</Label>
              <Select value={antennaType} onValueChange={setAntennaType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patch">Patch</SelectItem>
                  <SelectItem value="dipole">Dipole</SelectItem>
                  <SelectItem value="yagi">Yagi</SelectItem>
                  <SelectItem value="helix">Helix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copper">Copper</SelectItem>
                  <SelectItem value="aluminum">Aluminum</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isSimulating}
            className="w-full"
          >
            {isSimulating ? 'Running Simulation...' : 'Run Simulation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SimulationSetup;