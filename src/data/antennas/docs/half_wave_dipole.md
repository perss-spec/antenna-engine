# Half-Wave Dipole

**Category:** wire

## Overview

A fundamental wire antenna consisting of a straight conductor with length equal to half a wavelength at the operating frequency. It is center-fed and exhibits omnidirectional radiation in the plane perpendicular to its axis with a characteristic figure-8 pattern. The half-wave dipole serves as the reference antenna for gain measurements and is widely used in communications systems.

- **Frequency Range:** 1000000 - 10000000000 Hz
- **Typical Gain:** 2.1 to 2.2 dBi
- **Bandwidth:** 5-10%
- **Polarization:** linear
- **Applications:** FM radio broadcasting, Television antennas, Amateur radio, Wireless communications, Reference antenna for measurements, Base station antennas, Dipole arrays

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Total Length | L | m | 0.47 * c / f | 0.001 - 100 |
| Wire Radius | a | m | L / 1000 | 0.0001 - 0.01 |
| Operating Frequency | f | Hz | c / (2 * L / 0.47) | 1000000 - 10000000000 |
| Feed Gap | g | m | a / 10 | 0.00001 - 0.001 |

## Design Methodology

Design process involves calculating the physical length for resonance, determining wire dimensions for practical construction, and optimizing the feed structure for impedance matching.

### Step 1: Calculate Resonant Length

Determine the physical length for half-wavelength resonance including end effects

**Formula:** `L = 0.47 * c / f`

### Step 2: Select Wire Radius

Choose conductor radius based on bandwidth and mechanical requirements

**Formula:** `a = L / (2000 to 500) for typical applications`

### Step 3: Calculate Input Impedance

Determine theoretical input impedance at resonance

**Formula:** `Zin = 73.1 + j * 42.5 * ln(L/a) ohms`

### Step 4: Design Feed Structure

Design the feed gap and balun if required for balanced operation

**Formula:** `g = a / 10 to a / 5`

### Step 5: Optimize for Bandwidth

Adjust length and radius ratio for desired bandwidth

**Formula:** `BW ≈ 4 * a / L * 100%`

### Step 6: Verify Radiation Pattern

Confirm omnidirectional pattern in H-plane and figure-8 in E-plane

**Formula:** `E(θ) = cos(π/2 * cos(θ)) / sin(θ)`

## Equations

- **resonantFrequency:** `f = c / (2 * L_eff) where L_eff = 0.47 * λ`
- **inputImpedance:** `Zin = 73.1 + j * 42.5 * ln(L/a) ohms at resonance`
- **gain:** `G = 1.64 (2.15 dBi) for lossless dipole`
- **radiationPattern:** `E(θ) = cos(π/2 * cos(θ)) / sin(θ) in elevation plane`
- **bandwidth:** `BW = 4 * (a/L) * 100% for VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** Method of moments with sinusoidal current distribution I(z) = I0 * sin(π/2 - π*|z|/L)
- **Radiation Model:** Far-field integration using cos(π/2*cos(θ))/sin(θ) pattern function
- **Key Assumptions:**
  - Thin wire approximation (L >> a)
  - Perfect conductor
  - Sinusoidal current distribution
  - Far-field radiation
  - Free space environment

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016, Chapter 4
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012, Chapter 4
- Kraus, J.D. and Marhefka, R.J., 'Antennas for All Applications', 3rd Edition, McGraw-Hill, 2002, Chapter 8
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007, Chapter 5

