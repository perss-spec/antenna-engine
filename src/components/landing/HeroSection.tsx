import { useEffect, useState } from "react"

function GpuChipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" stroke="#76b900" strokeWidth="1.5" />
      <rect x="8" y="8" width="8" height="8" rx="1" fill="#76b900" opacity="0.35" />
      <line x1="8" y1="2" x2="8" y2="5" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="5" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="5" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="19" x2="8" y2="22" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="19" x2="16" y2="22" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2" y1="8" x2="5" y2="8" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2" y1="16" x2="5" y2="16" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="19" y1="8" x2="22" y2="8" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="19" y1="16" x2="22" y2="16" stroke="#76b900" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function AntennaIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8" aria-hidden="true">
      <line x1="24" y1="44" x2="24" y2="12" stroke="#76b900" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="12" x2="10" y2="4" stroke="#76b900" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="12" x2="38" y2="4" stroke="#76b900" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 24 Q24 18 32 24" stroke="#00e5c8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M12 28 Q24 20 36 28" stroke="#00e5c8" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M8 32 Q24 22 40 32" stroke="#76b900" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.3" />
      <circle cx="24" cy="12" r="2.5" fill="#76b900" style={{ filter: "drop-shadow(0 0 4px #76b900)" }} />
    </svg>
  )
}

interface HeroSectionProps {
  onLaunch?: () => void
}

export function HeroSection({ onLaunch }: HeroSectionProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <section
      className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center pt-20 pb-48"
      aria-label="Hero"
    >
      <nav
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,15,0.65)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(118,185,0,0.1)",
        }}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-2.5">
          <AntennaIcon />
          <div>
            <span className="font-bold text-sm tracking-wider" style={{ color: "#76b900" }}>PROMIN</span>
            <span className="font-light text-sm tracking-wide ml-1.5" style={{ color: "rgba(232,245,224,0.6)" }}>
              Antenna Studio
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {["Solver", "Visualizer", "ML Models", "Export"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(" ", "-")}`}
              className="font-mono text-xs tracking-wider transition-colors duration-200 hover:text-green-400"
              style={{ color: "rgba(118,185,0,0.55)" }}
            >
              {item}
            </a>
          ))}
        </div>

        <button
          onClick={onLaunch}
          className="font-mono text-xs px-4 py-2 rounded-lg border transition-all duration-200 hover:bg-green-400 hover:text-black"
          style={{ borderColor: "#76b900", color: "#76b900" }}
        >
          Launch App
        </button>
      </nav>

      <div
        className="flex flex-col items-center gap-6 max-w-4xl"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 1s ease, transform 1s ease",
        }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-xs"
          style={{
            borderColor: "rgba(118,185,0,0.35)",
            background: "rgba(118,185,0,0.08)",
            color: "#76b900",
            boxShadow: "0 0 20px rgba(118,185,0,0.12)",
          }}
        >
          <GpuChipIcon />
          <span>Powered by WebGPU</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-7xl md:text-9xl font-black tracking-tight leading-none"
            style={{
              background: "linear-gradient(135deg, #76b900 0%, #a8d800 35%, #00e5c8 70%, #00c8a0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(118,185,0,0.35))",
              letterSpacing: "-0.04em",
            }}
          >
            PROMIN
          </h1>
          <div
            className="text-2xl md:text-3xl font-light tracking-[0.35em] uppercase"
            style={{ color: "rgba(232,245,224,0.75)" }}
          >
            Antenna Studio
          </div>
        </div>

        <div
          className="w-24 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #76b900, #00e5c8, transparent)" }}
          aria-hidden="true"
        />

        <p
          className="text-base md:text-xl font-light leading-relaxed max-w-2xl"
          style={{ color: "rgba(200,230,160,0.7)" }}
        >
          GPU-Accelerated Antenna Design &amp; Electromagnetic Simulation
        </p>

        <p
          className="font-mono text-sm max-w-lg leading-relaxed"
          style={{ color: "rgba(118,185,0,0.55)" }}
        >
          425&times; faster than CPU solvers. Real-time MoM, ML surrogates, and Touchstone export —
          all running natively in your browser via WebGPU.
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-2">
          <button
            onClick={onLaunch}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #76b900, #00c8a0)",
              color: "#0a0a0f",
              boxShadow: "0 0 32px rgba(118,185,0,0.35), 0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            Launch Simulator
          </button>
          <button
            className="px-8 py-3 rounded-xl font-semibold text-sm border transition-all duration-200 hover:bg-green-400/10"
            style={{
              borderColor: "rgba(118,185,0,0.35)",
              color: "#76b900",
            }}
          >
            View Docs
          </button>
        </div>
      </div>
    </section>
  )
}
