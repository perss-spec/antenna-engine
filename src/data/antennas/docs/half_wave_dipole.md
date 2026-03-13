# Half-Wave Dipole

**Category:** wire

## Overview

A fundamental wire antenna consisting of a straight conductor with length equal to half a wavelength at the operating frequency. It is the most widely used and analyzed antenna type, serving as a reference for gain measurements and forming the basis for many other antenna designs. The half-wave dipole exhibits omnidirectional radiation in the plane perpendicular to its axis with a characteristic donut-shaped pattern.

- **Frequency Range:** 1000000 - 10000000000 Hz
- **Typical Gain:** 2.1 to 2.2 dBi
- **Bandwidth:** 5-10%
- **Polarization:** linear
- **Applications:** FM radio broadcasting, Television broadcasting, Amateur radio, Wireless communications, Reference antenna for measurements, Base element for antenna arrays, Dipole arrays, Yagi-Uda antennas

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Total Length | L | m | 0.47 * c / f | 0.45 - 0.49 |
| Wire Radius | a | m | 0.001 * c / f | 0.0001 - 0.01 |
| Feed Gap | g | m | 0.001 * c / f | 0.0001 - 0.01 |
| Operating Frequency | f | Hz | c / (2 * L) | 1000000 - 10000000000 |

## Design Methodology

Design process involves calculating the physical length for resonance, determining wire dimensions for practical construction, and optimizing for desired impedance matching.

### Step 1: Calculate Resonant Length

Determine the physical length for half-wavelength resonance including end effects

**Formula:** `L = 0.47 * c / f`

### Step 2: Select Wire Diameter

Choose wire radius based on bandwidth and mechanical requirements

**Formula:** `a = (0.001 to 0.01) * c / f`

### Step 3: Calculate Input Impedance

Determine theoretical input impedance for matching network design

**Formula:** `Z_in = 73.1 + j * 42.5 * ln(L/(2*a))`

### Step 4: Design Feed System

Design balun or matching network to interface with transmission line

**Formula:** `VSWR = (Z_0 + Z_in) / |Z_0 - Z_in|`

### Step 5: Optimize for Bandwidth

Adjust length and diameter ratio for desired bandwidth performance

**Formula:** `BW ≈ 4 * a / L`

### Step 6: Verify Radiation Pattern

Calculate radiation pattern and gain to confirm design objectives

**Formula:** `G = 1.64 (2.15 dBi)`

## Equations

- **resonantFrequency:** `f_r = c / (2 * L_eff) where L_eff = 0.47 * lambda`
- **inputImpedance:** `Z_in = R_r + j * X_in = 73.1 + j * 42.5 * ln(L/(2*a)) ohms`
- **gain:** `G = 1.64 (2.15 dBi) for ideal half-wave dipole`
- **radiationPattern:** `E(theta) = cos((pi/2)*cos(theta)) / sin(theta) in elevation plane`
- **bandwidth:** `BW = 2 * |f - f_r| / f_r for VSWR < 2, approximately 4*a/L`

## Mock Solver Hints

- **Impedance Model:** Use method of moments with sinusoidal current distribution I(z) = I_0 * sin(k*(L/2 - |z|)) for z along dipole axis
- **Radiation Model:** Far-field calculation using current distribution with radiation resistance R_r = 73.1 ohms and directivity D = 1.64
- **Key Assumptions:**
  - Thin wire approximation (L >> a)
  - Perfect conductor
  - Sinusoidal current distribution
  - Far-field radiation pattern
  - Free space environment

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016, Chapter 4
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012, Chapter 4
- Kraus, J.D. and Marhefka, R.J., 'Antennas for All Applications', 3rd Edition, McGraw-Hill, 2002, Chapter 8
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007, Chapter 5

