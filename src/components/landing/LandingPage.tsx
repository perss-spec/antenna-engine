import { useEffect, useState } from "react"
import { EMCanvas } from "./EMCanvas"
import { HeroSection } from "./HeroSection"
import { FeaturesSection } from "./FeaturesSection"
import { GpuHud } from "./GpuHud"

function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    const down = () => setActive(true)
    const up = () => setActive(false)
    window.addEventListener("mousemove", move)
    window.addEventListener("mousedown", down)
    window.addEventListener("mouseup", up)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mousedown", down)
      window.removeEventListener("mouseup", up)
    }
  }, [])

  return (
    <>
      <div
        className="fixed pointer-events-none z-50 hidden md:block"
        style={{
          left: pos.x - 16,
          top: pos.y - 16,
          width: 32,
          height: 32,
          border: `1px solid ${active ? "#38bdf8" : "rgba(14,165,233,0.6)"}`,
          borderRadius: "50%",
          transition: "left 0.08s ease, top 0.08s ease, border-color 0.15s ease, transform 0.15s ease",
          transform: active ? "scale(0.75)" : "scale(1)",
        }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none z-50 hidden md:block"
        style={{ left: pos.x - 8, top: pos.y - 0.5, width: 6, height: 1, background: "rgba(14,165,233,0.7)" }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none z-50 hidden md:block"
        style={{ left: pos.x + 2, top: pos.y - 0.5, width: 6, height: 1, background: "rgba(14,165,233,0.7)" }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none z-50 hidden md:block"
        style={{ left: pos.x - 0.5, top: pos.y - 8, width: 1, height: 6, background: "rgba(14,165,233,0.7)" }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none z-50 hidden md:block"
        style={{ left: pos.x - 0.5, top: pos.y + 2, width: 1, height: 6, background: "rgba(14,165,233,0.7)" }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none z-50 hidden md:block"
        style={{
          left: pos.x - 1.5,
          top: pos.y - 1.5,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: active ? "#38bdf8" : "#0ea5e9",
          boxShadow: `0 0 6px ${active ? "#38bdf8" : "#0ea5e9"}`,
        }}
        aria-hidden="true"
      />
    </>
  )
}

interface LandingPageProps {
  onLaunch: () => void
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  return (
    <main
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#0c0c0f", cursor: "none" }}
    >
      <CustomCursor />

      <div className="fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "#0c0c0f" }} />
        <EMCanvas />
      </div>

      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(12,12,15,0.7) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        <HeroSection onLaunch={onLaunch} />
        <FeaturesSection />
      </div>

      <GpuHud />

      <footer
        className="relative z-10 border-t py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs"
        style={{ borderColor: "rgba(14,165,233,0.1)", color: "rgba(14,165,233,0.35)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: "#0ea5e9" }}>PROMIN</span>
          <span style={{ color: "rgba(14,165,233,0.25)" }}>/</span>
          <span>Antenna Studio v2.4.1</span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: "rgba(56,189,248,0.4)" }}>wgpu backend active</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 ml-1 animate-pulse" aria-hidden="true" />
        </div>
        <span>&copy; 2026 PROMIN Technologies. All rights reserved.</span>
      </footer>
    </main>
  )
}
