# Planar Inverted-F Antenna (microstrip)

**Category:** microstrip

## Overview

A compact microstrip antenna consisting of a rectangular patch with a shorting pin and feed point, creating an inverted-F configuration. The shorting pin reduces the resonant length and provides impedance matching flexibility. Widely used in mobile communications due to its low profile and good impedance characteristics.

- **Frequency Range:** 800000000 - 6000000000 Hz
- **Typical Gain:** 2 to 6 dBi
- **Bandwidth:** 5-15%
- **Polarization:** linear
- **Applications:** Mobile phones, WiFi devices, Bluetooth modules, IoT sensors, Laptop computers, Tablet computers

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Patch Length | L | mm | 0.25 * lambda_eff | 10 - 50 |
| Patch Width | W | mm | 0.3 * lambda_eff | 8 - 40 |
| Substrate Height | h | mm | 0.01 * lambda_0 | 0.8 - 6.4 |
| Short Pin Position | Ls | mm | 0.05 * L | 1 - 8 |
| Feed Position | Lf | mm | 0.15 * L | 2 - 15 |
| Relative Permittivity | εr | dimensionless | 4.4 | 2.2 - 10.2 |

## Design Methodology

PIFA design involves determining patch dimensions for resonance, positioning the shorting pin and feed point for impedance matching, and optimizing for desired bandwidth and radiation characteristics.

### Step 1: Calculate Effective Dielectric Constant

Determine the effective permittivity accounting for fringing fields

**Formula:** `εeff = (εr + 1)/2 + (εr - 1)/2 * (1 + 12*h/W)^(-0.5)`

### Step 2: Estimate Initial Patch Length

Calculate quarter-wavelength resonant length with end effect correction

**Formula:** `L = c/(4*f*sqrt(εeff)) - ΔL, where ΔL = 0.412*h*(εeff+0.3)*(W/h+0.264)/((εeff-0.258)*(W/h+0.8))`

### Step 3: Determine Patch Width

Set width for desired radiation resistance and bandwidth

**Formula:** `W = c/(2*f*sqrt((εr+1)/2))`

### Step 4: Position Shorting Pin

Place shorting pin close to patch edge to minimize resonant length

**Formula:** `Ls = 0.05*L to 0.1*L`

### Step 5: Calculate Feed Position

Position feed point for 50-ohm impedance matching

**Formula:** `Lf = L*sqrt(Rin/120), where Rin is desired input resistance`

### Step 6: Optimize Dimensions

Fine-tune all parameters using electromagnetic simulation

**Formula:** `Adjust L, W, Ls, Lf iteratively for S11 < -10 dB`

## Equations

- **resonantFrequency:** `fr = c/(4*L*sqrt(εeff))`
- **inputImpedance:** `Zin = Rin + j*Xin, where Rin ≈ 120*(Lf/L)^2`
- **gain:** `G = η*D ≈ 1.76 + 10*log10(εeff*W*L/λ0^2)`
- **radiationPattern:** `E(θ,φ) = cos(θ)*sinc(k*W*sin(θ)*cos(φ)/2)*sinc(k*L*sin(θ)*sin(φ)/2)`
- **bandwidth:** `BW ≈ 3.77*(εr-1)*h*W/(εr^2*λ0*L)`

## Mock Solver Hints

- **Impedance Model:** transmission_line_with_short_circuit
- **Radiation Model:** rectangular_aperture_with_ground_plane
- **Key Assumptions:**
  - Thin substrate approximation
  - Perfect electric conductor
  - Negligible surface waves
  - Far-field radiation pattern

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Wiley, 2011
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012

