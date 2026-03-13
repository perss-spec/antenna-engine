# Small Loop Antenna (wire)

**Category:** wire

## Overview

A small loop antenna consists of a single turn of wire with circumference much smaller than one wavelength (typically C < λ/10). It exhibits magnetic dipole radiation characteristics with a null in the plane of the loop and maximum radiation perpendicular to the loop plane. Small loops are inherently narrowband with very low radiation resistance, requiring impedance matching networks for practical applications.

- **Frequency Range:** 100000 - 30000000000 Hz
- **Typical Gain:** -20 to -10 dBi
- **Bandwidth:** 1-3%
- **Polarization:** linear
- **Applications:** Direction finding, Radio astronomy, EMI/EMC testing, Magnetic field sensing, RFID readers, Portable HF communications, Loop-on-ground antennas

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Loop Radius | a | m | λ/(20*π) | 0.001 - 0.5 |
| Wire Radius | rw | m | a/100 | 0.0001 - 0.01 |
| Loop Circumference | C | m | 2*π*a | 0.01 - 3 |
| Electrical Size | ka | dimensionless | 2*π*a/λ | 0.01 - 1 |

## Design Methodology

Small loop antenna design focuses on achieving the desired frequency response while maintaining the small loop condition (C < λ/10). The design process involves determining loop dimensions, calculating radiation resistance, designing impedance matching, and optimizing for specific applications.

### Step 1: Determine Operating Frequency

Establish the center frequency and bandwidth requirements

**Formula:** `f0 = c/λ0`

### Step 2: Calculate Maximum Loop Dimensions

Ensure small loop condition is satisfied

**Formula:** `C_max = λ/10, a_max = λ/(20*π)`

### Step 3: Select Loop Radius

Choose loop radius based on size constraints and gain requirements

**Formula:** `a = (0.05 to 0.15) * λ/(2*π)`

### Step 4: Calculate Radiation Resistance

Determine the very low radiation resistance of the small loop

**Formula:** `Rr = 20*π^2*(ka)^4 = 197*(C/λ)^4`

### Step 5: Calculate Loop Inductance

Determine the loop inductance for impedance calculations

**Formula:** `L = μ0*a*[ln(8*a/rw) - 2]`

### Step 6: Design Impedance Matching

Design matching network to transform low radiation resistance to 50Ω

**Formula:** `Q = ωL/Rr, BW = 1/Q`

### Step 7: Optimize Wire Gauge

Select wire radius to minimize ohmic losses while maintaining structural integrity

**Formula:** `rw = a/50 to a/200`

### Step 8: Verify Performance

Calculate final gain, bandwidth, and efficiency

**Formula:** `G = 1.5*(ka)^4, η = Rr/(Rr + Rl)`

## Equations

- **resonantFrequency:** `f0 = 1/(2*π*sqrt(L*C_tuning))`
- **inputImpedance:** `Zin = Rr + Rl + j*ω*L`
- **gain:** `G = 1.5*(ka)^4 = 1.5*(2*π*a/λ)^4`
- **radiationPattern:** `E_θ = j*η*k*I*A*sin(φ)/(4*π*r), E_φ = j*η*k*I*A*cos(θ)*cos(φ)/(4*π*r)`
- **bandwidth:** `BW = Rr/(ω*L) = (ka)^4/[a*ln(8*a/rw) - 2*a]`

## Mock Solver Hints

- **Impedance Model:** Use lumped circuit model with series inductance L and radiation resistance Rr. Include ohmic resistance Rl = sqrt(π*f*μ0/σ)/(2*π*rw) for conductor losses.
- **Radiation Model:** Apply magnetic dipole radiation pattern with moment m = I*π*a^2. Use far-field approximation with sin(φ) dependence in H-plane and cos(θ)*cos(φ) in E-plane.
- **Key Assumptions:**
  - Small loop condition ka << 1
  - Uniform current distribution
  - Thin wire approximation
  - Far-field radiation pattern
  - Lossless dielectric medium

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 5
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 6
- Kraus, J.D. & Marhefka, R.J. 'Antennas for All Applications', 3rd Edition, Chapter 8
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 6

