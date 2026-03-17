import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Radio, Activity, Box, Download } from "lucide-react"
import { useT } from "@/lib/i18n"

interface LandingPageProps {
  onLaunch: () => void
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  const { t } = useT();
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
            <p className="text-sm text-text-dim uppercase tracking-wider">{t('landing.subtitle')}</p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
              {t('landing.title')}
            </h1>
            <p className="text-[15px] text-text-muted max-w-2xl leading-relaxed">
              {t('landing.desc')}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={onLaunch} size="lg">
                {t('landing.openWorkspace')}
              </Button>
              <Button variant="outline" size="lg">
                {t('landing.docs')}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="text-sm font-semibold mb-3">{t('landing.sessionOverview')}</div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={<Radio className="w-4 h-4" />} label={t('landing.antennaTypes')} value="31" />
              <MetricCard icon={<Activity className="w-4 h-4" />} label={t('landing.sweepPoints')} value="101" />
              <MetricCard icon={<Box className="w-4 h-4" />} label={t('landing.3dView')} value={t('landing.enabled')} />
              <MetricCard icon={<Download className="w-4 h-4" />} label={t('landing.export')} value={t('landing.touchstone')} />
            </div>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <WorkflowCard
            title={t('landing.step1.title')}
            text={t('landing.step1.text')}
          />
          <WorkflowCard
            title={t('landing.step2.title')}
            text={t('landing.step2.text')}
          />
          <WorkflowCard
            title={t('landing.step3.title')}
            text={t('landing.step3.text')}
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
