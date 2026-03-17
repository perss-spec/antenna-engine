import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Radio, Activity, Box, Download } from "lucide-react"

interface LandingPageProps {
  onLaunch: () => void
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  return (
    <main className="min-h-screen bg-base text-text-primary">
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent text-white font-semibold flex items-center justify-center shadow-sm">
              P
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">PROMIN</div>
              <div className="text-xs text-text-dim">Antenna Studio</div>
            </div>
          </div>
          <Badge variant="outline">v0.3</Badge>
        </header>

        <section className="pt-10 md:pt-14 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
          <div className="space-y-5">
            <p className="text-sm text-text-dim uppercase tracking-wider">Antenna Engineering Workspace</p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
              Design, simulate and analyze antennas in one flow.
            </h1>
            <p className="text-[15px] text-text-muted max-w-2xl leading-relaxed">
              A calmer, tool-first interface for rapid antenna iteration. Start from presets, run sweeps,
              inspect S-parameters and move to export without jumping between disconnected screens.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={onLaunch} size="lg">
                Open Workspace
              </Button>
              <Button variant="outline" size="lg">
                Documentation
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="text-sm font-semibold mb-3">Session Overview</div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={<Radio className="w-4 h-4" />} label="Antenna Types" value="31" />
              <MetricCard icon={<Activity className="w-4 h-4" />} label="Sweep Points" value="101" />
              <MetricCard icon={<Box className="w-4 h-4" />} label="3D View" value="Enabled" />
              <MetricCard icon={<Download className="w-4 h-4" />} label="Export" value="Touchstone/CSV" />
            </div>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <WorkflowCard
            title="1. Configure"
            text="Select an antenna family, edit parameters and apply frequency presets."
          />
          <WorkflowCard
            title="2. Simulate"
            text="Run sweep or optimization and monitor progress from the top status bar."
          />
          <WorkflowCard
            title="3. Analyze & Export"
            text="Review S11, Smith, 3D and radiation tabs, then export results."
          />
        </section>
      </div>
    </main>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-base p-3">
      <div className="flex items-center gap-2 text-text-muted mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-sm font-medium text-text-primary">{value}</div>
    </div>
  )
}

function WorkflowCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="text-sm text-text-muted leading-relaxed">{text}</div>
    </div>
  )
}
