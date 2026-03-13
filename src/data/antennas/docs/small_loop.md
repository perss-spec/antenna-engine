# Small Loop Antenna (wire)

**Category:** wire

## Overview

A small loop antenna consists of a single turn of wire with circumference much smaller than one wavelength (typically C < λ/10). It exhibits magnetic dipole radiation characteristics with a null in the plane of the loop and maximum radiation perpendicular to the loop plane. Small loops are inherently narrowband with very low radiation resistance, requiring impedance matching networks for practical applications.

- **Frequency Range:** 100000 - 30000000000 Hz
- **Typical Gain:** -20 to -10 dBi
- **Bandwidth:** 1-5%
- **Polarization:** linear
- **Applications:** Direction finding, Radio astronomy, EMC testing, Magnetic field sensing, RFID readers, Portable HF antennas, Loop-on-ground antennas

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Loop Radius | a | m | λ/(20*π) | 0.001 - 1 |
| Wire Radius | rw | m | a/100 | 0.0001 - 0.01 |
| Loop Circumference | C | m | 2*π*a | 0.01 - 10 |
| Electrical Size | ka | dimensionless | 2*π*a/λ | 0.01 - 0.628 |

## Design Methodology

Small loop antenna design focuses on achieving the desired frequency response while maintaining the small loop condition (C < λ/10). The design process involves determining loop dimensions, calculating radiation resistance, and designing impedance matching networks.

### Step 1: Determine Operating Frequency

Establish the center frequency and bandwidth requirements

**Formula:** `f0 = c/λ0`

### Step 2: Calculate Maximum Loop Dimensions

Ensure small loop condition is satisfied

**Formula:** `C_max = λ/10, a_max = λ/(20*π)`

### Step 3: Select Loop Radius

Choose loop radius based on size constraints and gain requirements

**Formula:** `a = k*λ/(2*π), where k < 0.1`

### Step 4: Calculate Radiation Resistance

Determine the radiation resistance for power calculations

**Formula:** `Rr = 20*π^2*(ka)^4 = 197*(C/λ)^4`

### Step 5: Calculate Loss Resistance

Determine ohmic losses in the conductor

**Formula:** `Rl = (C/(2*π*rw))*sqrt(π*f*μ0/σ)`

### Step 6: Design Matching Network

Calculate required reactance cancellation and impedance transformation

**Formula:** `XL = ωL = 31.17*(C/λ)*ln(8*a/rw - 2)`

### Step 7: Calculate Efficiency

Determine radiation efficiency

**Formula:** `η = Rr/(Rr + Rl)`

## Equations

- **resonantFrequency:** `f0 = 1/(2*π*sqrt(L*C_tuning))`
- **inputImpedance:** `Zin = Rr + Rl + j*ωL = Rr + Rl + j*31.17*(C/λ)*ln(8*a/rw - 2)`
- **gain:** `G = 1.5*η*(ka)^2 = 1.5*η*(2*π*a/λ)^2`
- **radiationPattern:** `E_θ = j*η0*I*ka^2*sin(φ)*exp(-jkr)/(4*π*r), E_φ = 0`
- **bandwidth:** `BW = 2*Rr/ωL = 2*Rr/(31.17*(C/λ)*ln(8*a/rw - 2))`

## Mock Solver Hints

- **Impedance Model:** Use method of moments with thin-wire approximation for current distribution. Model as lumped inductance with radiation and loss resistances.
- **Radiation Model:** Apply magnetic dipole radiation pattern with sin(φ) dependence in elevation. Use small loop approximation for far-field calculations.
- **Key Assumptions:**
  - Small loop condition: ka << 1
  - Uniform current distribution
  - Thin wire approximation: a >> rw
  - Far-field radiation pattern
  - Lossless dielectric medium

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 5
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 6
- Kraus, J.D. & Marhefka, R.J. 'Antennas for All Applications', 3rd Edition, Chapter 8
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 6

