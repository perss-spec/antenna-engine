import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SimulationResult {
  vswr: number;
  gain: number;
  bandwidth: number;
  efficiency: number;
  farFieldPattern?: number[][];
}

interface ResultsViewerProps {
  results: SimulationResult | null;
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({ results }) => {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simulation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No simulation results available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulation Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{results.vswr.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">VSWR</div>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{results.gain.toFixed(1)} dBi</div>
            <div className="text-sm text-muted-foreground">Gain</div>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{results.bandwidth.toFixed(1)} MHz</div>
            <div className="text-sm text-muted-foreground">Bandwidth</div>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{(results.efficiency * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Efficiency</div>
          </div>
        </div>

        {results.farFieldPattern && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Far Field Pattern</h3>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Far field visualization would be rendered here</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultsViewer;