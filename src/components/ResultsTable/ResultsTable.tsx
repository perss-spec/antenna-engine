import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface ResultsTableProps {
  frequencies: number[]
  s11Db: number[]
  impedanceReal: number[]
  impedanceImag: number[]
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

function calcVswr(s11Db: number): number {
  const gamma = Math.abs(dbToLinear(s11Db))
  if (gamma >= 1) return Infinity
  return (1 + gamma) / (1 - gamma)
}

function s11ColorClass(db: number): string {
  if (db < -10) return "text-success"
  if (db <= -6) return "text-warning"
  return "text-error"
}

export function ResultsTable({ frequencies, s11Db, impedanceReal, impedanceImag }: ResultsTableProps) {
  const hasData = frequencies.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Frequency Data</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-text-muted text-xs">No data</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-text-muted uppercase tracking-wider border-b border-border sticky top-0 bg-surface">
                <tr>
                  <th className="py-2 px-3 text-left">Frequency (MHz)</th>
                  <th className="py-2 px-3 text-left">S11 (dB)</th>
                  <th className="py-2 px-3 text-left">|S11|</th>
                  <th className="py-2 px-3 text-left">Z Real (&Omega;)</th>
                  <th className="py-2 px-3 text-left">Z Imag (&Omega;)</th>
                  <th className="py-2 px-3 text-left">VSWR</th>
                </tr>
              </thead>
              <tbody>
                {frequencies.map((freq, i) => {
                  const db = s11Db[i] ?? 0
                  const linear = Math.abs(dbToLinear(db))
                  const vswr = calcVswr(db)
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-2 px-3 tabular-nums">{(freq / 1e6).toFixed(1)}</td>
                      <td className={`py-2 px-3 tabular-nums ${s11ColorClass(db)}`}>{db.toFixed(1)}</td>
                      <td className="py-2 px-3 tabular-nums">{linear.toFixed(3)}</td>
                      <td className="py-2 px-3 tabular-nums">{(impedanceReal[i] ?? 0).toFixed(1)}</td>
                      <td className="py-2 px-3 tabular-nums">{(impedanceImag[i] ?? 0).toFixed(1)}</td>
                      <td className="py-2 px-3 tabular-nums">{isFinite(vswr) ? vswr.toFixed(2) : "∞"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
