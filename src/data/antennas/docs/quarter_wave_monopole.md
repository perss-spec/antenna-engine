# Quarter-Wave Monopole (wire)

**Category:** wire

## Overview

A quarter-wavelength vertical wire antenna mounted over a ground plane, representing half of a dipole antenna. It exhibits omnidirectional radiation pattern in the horizontal plane with vertical polarization. The ground plane acts as an image plane, creating the effect of a full half-wave dipole.

- **Frequency Range:** 1000000 - 10000000000 Hz
- **Typical Gain:** 2.15 to 5.15 dBi
- **Bandwidth:** 5-15%
- **Polarization:** linear
- **Applications:** Mobile communications, Base station antennas, Vehicle antennas, Portable radios, IoT devices, Amateur radio

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Physical Length | L | m | 0.95 * c / (4 * f) | 0.001 - 100 |
| Wire Radius | a | m | lambda / 1000 | 0.0001 - 0.01 |
| Ground Plane Radius | Rg | m | lambda / 4 | 0.01 - 10 |
| Feed Height | h | m | 0 | 0 - 0.1 |

## Design Methodology

Design process involves determining the physical length for resonance, selecting appropriate wire diameter, sizing the ground plane, and optimizing the feed structure for desired impedance matching.

### Step 1: Calculate Resonant Length

Determine the physical length for quarter-wave resonance including end effects

**Formula:** `L = 0.95 * c / (4 * f)`

### Step 2: Select Wire Diameter

Choose wire radius based on bandwidth and mechanical requirements

**Formula:** `a = lambda / (200 to 2000)`

### Step 3: Size Ground Plane

Design ground plane radius for proper radiation pattern and impedance

**Formula:** `Rg >= lambda / 4`

### Step 4: Calculate Input Impedance

Determine theoretical input impedance at resonance

**Formula:** `Zin = 36.5 + j * X`

### Step 5: Design Feed Structure

Design coaxial feed connection and matching network if needed

**Formula:** `VSWR = (1 + |Gamma|) / (1 - |Gamma|)`

### Step 6: Optimize for Bandwidth

Adjust wire diameter and length for desired bandwidth

**Formula:** `BW = 2 * (f2 - f1) / f0`

## Equations

- **resonantFrequency:** `f0 = c / (4 * L_eff) where L_eff = L + delta_L`
- **inputImpedance:** `Zin = 36.5 + j * 21.25 * tan(beta * L) for thin wire over infinite ground`
- **gain:** `G = 5.15 dBi for infinite ground plane, G = 2.15 dBi for small ground plane`
- **radiationPattern:** `E_theta = j * 60 * I0 * cos(beta * L * cos(theta)) / (r * sin(theta))`
- **bandwidth:** `BW = 4 * a / (lambda * ln(L/a)) for VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** Method of moments with thin wire approximation and image theory for ground plane effects
- **Radiation Model:** Far-field integration using current distribution I(z) = I0 * cos(beta * z) with image currents
- **Key Assumptions:**
  - Perfect conducting ground plane
  - Thin wire approximation (L >> a)
  - Far-field radiation
  - Linear current distribution

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 4
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 4
- Kraus, J.D. & Marhefka, R.J. 'Antennas for All Applications', 3rd Edition, Chapter 8
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 5

