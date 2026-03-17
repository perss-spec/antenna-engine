import { EMCanvas } from "./EMCanvas"
import { HeroSection } from "./HeroSection"
import { FeaturesSection } from "./FeaturesSection"
import { GpuHud } from "./GpuHud"

interface LandingPageProps {
  onLaunch: () => void
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  return (
    <main
      className="relative min-h-screen overflow-x-hidden overflow-y-auto"
      style={{ background: "#0c0c0f" }}
    >
      <EMCanvas />
      <HeroSection onLaunch={onLaunch} />
      <FeaturesSection />
      <GpuHud />
    </main>
  )
}
