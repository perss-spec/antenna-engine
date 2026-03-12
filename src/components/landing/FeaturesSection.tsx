import { useEffect, useRef, useState } from "react"

const features = [
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="4" stroke="#76b900" strokeWidth="1.5" strokeDasharray="4 2" />
        <circle cx="16" cy="16" r="8" stroke="#76b900" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="3" fill="#76b900" opacity="0.7" />
        <line x1="16" y1="2" x2="16" y2="8" stroke="#76b900" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="16" y2="30" stroke="#76b900" strokeWidth="1.5" />
        <line x1="2" y1="16" x2="8" y2="16" stroke="#76b900" strokeWidth="1.5" />
        <line x1="24" y1="16" x2="30" y2="16" stroke="#76b900" strokeWidth="1.5" />
      </svg>
    ),
    tag: "SOLVER",
    title: "Method of Moments",
    desc: "Full-wave MoM solver with GPU-parallelized impedance matrix assembly. 1024 unknowns solved in under 1 ms on modern GPUs.",
    detail: "Galerkin / Rao-Wilton-Glisson basis functions",
    color: "#76b900",
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-hidden="true">
        <path d="M4 28 L10 18 L16 22 L22 10 L28 14" stroke="#00e5c8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="3" width="10" height="10" rx="2" stroke="#00e5c8" strokeWidth="1.3" opacity="0.5" />
        <rect x="19" y="19" width="10" height="10" rx="2" stroke="#00e5c8" strokeWidth="1.3" opacity="0.5" />
        <circle cx="16" cy="6" r="2.5" stroke="#00e5c8" strokeWidth="1.3" />
        <circle cx="10" cy="26" r="2.5" fill="#00e5c8" opacity="0.4" />
      </svg>
    ),
    tag: "VISUALIZATION",
    title: "Real-time 3D Viewport",
    desc: "Live antenna geometry rendering with current distribution overlays, far-field radiation patterns, and interactive gain plots.",
    detail: "Three.js WebGL renderer + custom shaders",
    color: "#00e5c8",
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-hidden="true">
        <rect x="3" y="10" width="10" height="12" rx="2" stroke="#76b900" strokeWidth="1.4" />
        <rect x="19" y="10" width="10" height="12" rx="2" stroke="#76b900" strokeWidth="1.4" />
        <path d="M13 16 C15 14 17 18 19 16" stroke="#76b900" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="7" r="2" fill="#76b900" opacity="0.5" />
        <circle cx="24" cy="7" r="2" fill="#76b900" opacity="0.5" />
        <path d="M8 9 L8 10 M24 9 L24 10" stroke="#76b900" strokeWidth="1.2" />
        <path d="M6 25 L8 28 L10 25 M22 25 L24 28 L26 25" stroke="#76b900" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    tag: "MACHINE LEARNING",
    title: "ML Surrogate Models",
    desc: "ONNX-Runtime inference for instantaneous S-parameter prediction. 10,000\u00D7 faster than full-wave simulation for design sweeps.",
    detail: "Pre-trained on 2M+ antenna configurations",
    color: "#76b900",
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-hidden="true">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke="#00e5c8" strokeWidth="1.5" />
        <line x1="4" y1="12" x2="28" y2="12" stroke="#00e5c8" strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="6" x2="10" y2="12" stroke="#00e5c8" strokeWidth="1" opacity="0.5" />
        <text x="7" y="10.5" fontSize="4.5" fill="#00e5c8" fontFamily="monospace" opacity="0.8">.s2p</text>
        <path d="M10 18 L14 18 M10 21.5 L18 21.5" stroke="#00e5c8" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        <path d="M22 18 L22 24 M19 21 L25 21" stroke="#00e5c8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    tag: "EXPORT",
    title: "Touchstone Export",
    desc: "One-click S-parameter export to industry-standard .s1p and .s2p Touchstone format. Compatible with all major EDA tools.",
    detail: "Keysight ADS, AWR, ANSYS HFSS ready",
    color: "#00e5c8",
  },
]

function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), index * 120)
          obs.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [index])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl p-px"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${index * 0.12}s, transform 0.7s ease ${index * 0.12}s`,
        background: hovered
          ? `linear-gradient(135deg, ${feature.color}55, ${feature.color}18)`
          : `linear-gradient(135deg, ${feature.color}22, transparent)`,
      }}
    >
      <div
        className="relative h-full rounded-xl p-6 flex flex-col gap-4"
        style={{
          background: hovered ? "rgba(10,12,10,0.88)" : "rgba(10,10,15,0.75)",
          backdropFilter: "blur(12px)",
          boxShadow: hovered
            ? `0 0 32px ${feature.color}22, inset 0 1px 0 ${feature.color}22`
            : "inset 0 1px 0 rgba(118,185,0,0.06)",
          transition: "all 0.35s ease",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: `${feature.color}18`, boxShadow: `0 0 14px ${feature.color}22` }}
          >
            {feature.icon}
          </div>
          <span
            className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded"
            style={{ color: feature.color, background: `${feature.color}14`, border: `1px solid ${feature.color}25` }}
          >
            {feature.tag}
          </span>
        </div>

        <h3
          className="text-lg font-bold leading-tight"
          style={{ color: hovered ? feature.color : "#e8f5e0" }}
        >
          {feature.title}
        </h3>

        <p className="text-sm leading-relaxed" style={{ color: "rgba(180,220,140,0.7)" }}>
          {feature.desc}
        </p>

        <div className="mt-auto">
          <span
            className="inline-block font-mono text-[10px] px-2 py-1 rounded border"
            style={{
              color: "rgba(118,185,0,0.6)",
              borderColor: "rgba(118,185,0,0.15)",
              background: "rgba(118,185,0,0.05)",
            }}
          >
            {feature.detail}
          </span>
        </div>

        {hovered && (
          <div
            className="absolute top-0 right-0 w-16 h-16 rounded-tr-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at top right, ${feature.color}20, transparent 70%)`,
            }}
          />
        )}
      </div>
    </div>
  )
}

export function FeaturesSection() {
  const titleRef = useRef<HTMLDivElement>(null)
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTitleVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="relative z-10 px-6 pb-40 pt-8 max-w-6xl mx-auto" id="features" aria-label="Features">
      <div
        ref={titleRef}
        className="text-center mb-14"
        style={{
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: "#76b900" }}>
          Core Capabilities
        </p>
        <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#e8f5e0" }}>
          From antenna geometry to{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #76b900, #00e5c8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            S-parameters in milliseconds
          </span>
        </h2>
        <p className="mt-4 text-base leading-relaxed max-w-xl mx-auto" style={{ color: "rgba(180,220,140,0.6)" }}>
          GPU-parallelized solvers replace multi-hour simulations with sub-millisecond results.
          Design, iterate, and export — all in the browser.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <FeatureCard key={f.title} feature={f} index={i} />
        ))}
      </div>
    </section>
  )
}
