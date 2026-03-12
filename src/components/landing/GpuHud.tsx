import { useEffect, useState, type ReactNode } from "react"

function AnimatedCounter({ target, duration = 1800 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setValue(target)
        clearInterval(timer)
      } else {
        setValue(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])

  return <>{value}</>
}

function BlinkingCursor() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setVisible((v) => !v), 530)
    return () => clearInterval(t)
  }, [])
  return <span className="inline-block w-2 h-4 bg-green-400 ml-0.5" style={{ opacity: visible ? 1 : 0, verticalAlign: "text-bottom" }} />
}

function StatCell({
  label,
  value,
  accent,
  sublabel,
  highlight,
}: {
  label: string
  value: ReactNode
  accent: string
  sublabel: string
  highlight?: boolean
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-3 py-2.5 gap-0.5"
      style={{ background: highlight ? "rgba(0,229,200,0.06)" : "rgba(10,10,15,0.7)" }}
    >
      <span className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(118,185,0,0.55)" }}>
        {label}
      </span>
      <span className="text-base font-bold leading-tight tabular-nums" style={{ color: accent, textShadow: `0 0 12px ${accent}88` }}>
        {value}
      </span>
      <span className="text-[9px]" style={{ color: "rgba(118,185,0,0.35)" }}>
        {sublabel}
      </span>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] tracking-widest" style={{ color: "rgba(118,185,0,0.45)" }}>
        {label}
      </span>
      <span className="font-semibold tabular-nums" style={{ color, textShadow: `0 0 8px ${color}66` }}>
        {value}
      </span>
    </div>
  )
}

export function GpuHud() {
  const [tick, setTick] = useState(0)
  const [gpuMs, setGpuMs] = useState(0.8)
  const [s11, setS11] = useState(-18.3)
  const [zImag, setZImag] = useState(42.5)

  useEffect(() => {
    const t = setInterval(() => {
      setTick((v) => v + 1)
      setGpuMs((v) => +(v + (Math.random() - 0.5) * 0.08).toFixed(2))
      setS11((v) => +(v + (Math.random() - 0.5) * 0.12).toFixed(1))
      setZImag((v) => +(v + (Math.random() - 0.5) * 0.3).toFixed(1))
    }, 900)
    return () => clearInterval(t)
  }, [])

  const cpuMs = 340
  const speedup = Math.round(cpuMs / gpuMs)

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-4 pointer-events-none"
      role="status"
      aria-label="GPU Performance HUD"
    >
      <div
        className="rounded-xl border font-mono text-xs overflow-hidden"
        style={{
          background: "rgba(10,10,15,0.82)",
          backdropFilter: "blur(14px)",
          borderColor: "rgba(118,185,0,0.28)",
          boxShadow: "0 0 28px rgba(118,185,0,0.12), inset 0 1px 0 rgba(118,185,0,0.08)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-1.5 border-b"
          style={{ borderColor: "rgba(118,185,0,0.15)", background: "rgba(118,185,0,0.06)" }}
        >
          <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #76b900" }} />
          <span className="text-green-400 tracking-widest text-[10px] uppercase">wgpu backend</span>
          <span className="text-green-900 mx-1">|</span>
          <span className="text-green-600">live</span>
          <BlinkingCursor />
          <span className="ml-auto text-green-900 text-[10px]">PROMIN/v2.4.1</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "rgba(118,185,0,0.06)" }}>
          <StatCell label="GPU SOLVE" value={`${gpuMs.toFixed(2)} ms`} accent="#76b900" sublabel="wgpu backend" />
          <StatCell label="CPU FALLBACK" value={`${cpuMs} ms`} accent="#4a7a30" sublabel="single-threaded" />
          <StatCell
            label="SPEEDUP"
            value={
              <span>
                <AnimatedCounter target={speedup} duration={1400} />
                <span className="text-green-600">&times;</span>
              </span>
            }
            accent="#00e5c8"
            sublabel="GPU vs CPU"
            highlight
          />
          <StatCell label="SEGMENTS" value="1,024" accent="#76b900" sublabel="MoM unknowns" />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-[11px]">
          <Metric label="FREQ" value="2.4 GHz" color="#76b900" />
          <Metric label="S&#x2081;&#x2081;" value={`${s11.toFixed(1)} dB`} color="#00e5c8" />
          <Metric label="Z" value={`73.1 + j${zImag.toFixed(1)} \u03A9`} color="#76b900" />
          <Metric label="VSWR" value="1.28" color="#00e5c8" />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-green-900">1024 threads/block</span>
            <span className="text-green-900">|</span>
            <span className="text-green-700">{tick % 2 === 0 ? "\u25B6 SOLVING" : "\u25B6 SOLVING\u00B7"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
