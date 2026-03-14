import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
}

interface WaveRing {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  speed: number
}

export function EMCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let particles: Particle[] = []
    let waves: WaveRing[] = []
    let frameCount = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const spawnParticle = (): Particle => {
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * Math.min(canvas.width, canvas.height) * 0.48
      const x = cx + Math.cos(angle) * dist
      const y = cy + Math.sin(angle) * dist
      const speed = 0.35 + Math.random() * 0.85
      const fieldAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.6
      return {
        x,
        y,
        vx: Math.cos(fieldAngle) * speed,
        vy: Math.sin(fieldAngle) * speed,
        life: 0,
        maxLife: 180 + Math.random() * 200,
        size: 0.9 + Math.random() * 1.6,
        hue: Math.random(),
      }
    }

    const spawnWave = () => {
      if (waves.length >= 3) return
      waves.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 0,
        maxRadius: Math.min(canvas.width, canvas.height) * 0.52,
        alpha: 0.55,
        speed: 1.3 + Math.random() * 0.6,
      })
    }

    for (let i = 0; i < 120; i++) {
      const p = spawnParticle()
      p.life = Math.random() * p.maxLife
      particles.push(p)
    }

    spawnWave()

    const drawGrid = () => {
      const cx = canvas.width / 2
      const cy = canvas.height / 2

      ctx.save()

      ctx.strokeStyle = "rgba(14,165,233,0.04)"
      ctx.lineWidth = 0.5
      const spacing = 52
      for (let x = cx % spacing; x < canvas.width; x += spacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = cy % spacing; y < canvas.height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      const radii = [100, 220, 360]
      ctx.strokeStyle = "rgba(56,189,248,0.05)"
      ctx.lineWidth = 0.5
      for (const r of radii) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.restore()
    }

    const getParticleColor = (p: Particle, alpha: number) => {
      const r = Math.round(14 * (1 - p.hue) + 56 * p.hue)
      const g = Math.round(165 * (1 - p.hue) + 189 * p.hue)
      const b = Math.round(233 * (1 - p.hue) + 248 * p.hue)
      return `rgba(${r},${g},${b},${alpha})`
    }

    const draw = () => {
      frameCount++

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(12,12,15,1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drawGrid()

      if (frameCount % 300 === 0) spawnWave()

      waves = waves.filter((w) => w.alpha > 0.015)
      for (const w of waves) {
        ctx.save()
        ctx.strokeStyle = `rgba(56,189,248,${w.alpha * 0.55})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2)
        ctx.stroke()

        if (w.radius > 40) {
          ctx.strokeStyle = `rgba(14,165,233,${w.alpha * 0.3})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.arc(w.x, w.y, w.radius * 0.72, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()

        w.radius += w.speed
        w.alpha *= 0.993
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++

        const cx = canvas.width / 2
        const cy = canvas.height / 2
        const dx = p.x - cx
        const dy = p.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy) + 1
        const curlStrength = 0.0012
        p.vx += (-dy / dist) * curlStrength
        p.vy += (dx / dist) * curlStrength

        p.vx += (-dx / dist) * 0.00025
        p.vy += (-dy / dist) * 0.00025

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.8) {
          p.vx = (p.vx / speed) * 1.8
          p.vy = (p.vy / speed) * 1.8
        }

        p.x += p.vx
        p.y += p.vy

        const lifeFade = Math.min(p.life / 40, 1) * Math.min((p.maxLife - p.life) / 40, 1)

        const glowRadius = p.size * 4
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius)
        grd.addColorStop(0, getParticleColor(p, lifeFade * 0.95))
        grd.addColorStop(0.35, getParticleColor(p, lifeFade * 0.4))
        grd.addColorStop(1, getParticleColor(p, 0))
        ctx.beginPath()
        ctx.fillStyle = grd
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()

        if (
          p.life >= p.maxLife ||
          p.x < -30 ||
          p.x > canvas.width + 30 ||
          p.y < -30 ||
          p.y > canvas.height + 30
        ) {
          particles[i] = spawnParticle()
        }
      }

      const lg = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, 320
      )
      lg.addColorStop(0, "rgba(14,165,233,0.05)")
      lg.addColorStop(0.5, "rgba(56,189,248,0.02)")
      lg.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = lg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ mixBlendMode: "screen" }}
      aria-hidden="true"
    />
  )
}
