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
| Wire Radius | a | m | lambda / 1000 | 0.0001 - 0.1 |
| Ground Plane Radius | Rg | m | lambda / 4 | 0.01 - 1000 |
| Feed Height | h | m | 0 | 0 - 0.1 |

## Design Methodology

Design process involves determining the optimal monopole length for resonance, selecting appropriate wire diameter, sizing the ground plane, and matching the input impedance to the feed system.

### Step 1: Calculate Quarter-Wave Length

Determine the physical length accounting for end effects

**Formula:** `L = 0.95 * c / (4 * f)`

### Step 2: Select Wire Diameter

Choose wire radius based on bandwidth and mechanical requirements

**Formula:** `a = lambda / (200 to 2000)`

### Step 3: Size Ground Plane

Determine minimum ground plane radius for proper operation

**Formula:** `Rg >= lambda / 4`

### Step 4: Calculate Input Impedance

Estimate the feed point impedance

**Formula:** `Zin = 36.5 + j * 21.25 * ln(lambda / (2 * pi * a))`

### Step 5: Design Matching Network

Match 36.5 ohm impedance to 50 ohm system

**Formula:** `VSWR = 50 / 36.5 = 1.37`

### Step 6: Optimize for Bandwidth

Adjust wire diameter and length for desired bandwidth

**Formula:** `BW = 2 * a / lambda * 100%`

## Equations

- **resonantFrequency:** `f_r = c / (4 * L_eff) where L_eff = L + delta_L`
- **inputImpedance:** `Z_in = 36.5 + j * 21.25 * ln(lambda / (2 * pi * a))`
- **gain:** `G = 5.15 dBi (over infinite ground plane)`
- **radiationPattern:** `E_theta = j * 60 * I_0 * cos(pi/2 * cos(theta)) / sin(theta) * exp(-j*k*r) / r`
- **bandwidth:** `BW = 4 * a / lambda * 100% (approximate)`

## Mock Solver Hints

- **Impedance Model:** Method of moments with thin wire approximation and image theory for ground plane effects
- **Radiation Model:** Far-field pattern using image theory with ground plane reflection coefficient
- **Key Assumptions:**
  - Perfect ground plane
  - Thin wire approximation (L >> a)
  - Far-field radiation
  - Linear current distribution

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition
- Kraus, J.D. & Marhefka, R.J. 'Antennas for All Applications', 3rd Edition
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition

