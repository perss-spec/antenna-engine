# Quadrifilar Helical (wire)

**Category:** wire

## Overview

A quadrifilar helical antenna consists of four helical wire elements wound around a cylindrical support structure, typically fed in quadrature phase to produce circular polarization. This antenna type provides excellent circular polarization purity and hemispherical coverage patterns. It is widely used in satellite communications, GPS applications, and mobile communications where circular polarization and broad beamwidth are required.

- **Frequency Range:** 100000000 - 10000000000 Hz
- **Typical Gain:** 0 to 8 dBi
- **Bandwidth:** 10-20%
- **Polarization:** circular
- **Applications:** Satellite communications, GPS receivers, Mobile satellite terminals, RFID readers, Telemetry systems, Space communications

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Helix Diameter | D | m | lambda / (2 * pi) | 0.05 - 0.5 |
| Helix Length | L | m | lambda / 4 | 0.1 - 2 |
| Pitch Angle | alpha | degrees | atan(lambda / (4 * pi * D)) | 5 - 45 |
| Wire Radius | a | m | lambda / 1000 | 0.0001 - 0.01 |
| Number of Turns | N | dimensionless | L / (pi * D * tan(alpha)) | 0.25 - 3 |

## Design Methodology

Design process involves determining helix geometry for desired frequency, calculating wire dimensions, optimizing for circular polarization, and implementing quadrature feed network.

### Step 1: Determine Operating Frequency

Establish center frequency and bandwidth requirements

**Formula:** `f0 = c / lambda`

### Step 2: Calculate Helix Diameter

Set diameter for proper circumference relative to wavelength

**Formula:** `D = lambda / (2 * pi)`

### Step 3: Determine Helix Length

Calculate axial length for quarter-wave resonance

**Formula:** `L = lambda / 4`

### Step 4: Calculate Pitch Angle

Determine pitch angle for optimal radiation characteristics

**Formula:** `alpha = atan(lambda / (4 * pi * D))`

### Step 5: Size Wire Elements

Select wire radius for mechanical stability and electrical performance

**Formula:** `a = lambda / 1000`

### Step 6: Design Feed Network

Create 90-degree hybrid network for quadrature excitation

**Formula:** `Z_feed = 50 / 4 = 12.5 ohms per element`

### Step 7: Optimize Axial Ratio

Adjust element spacing and phasing for circular polarization

**Formula:** `AR = 20 * log10((E_max + E_min) / (E_max - E_min))`

## Equations

- **resonantFrequency:** `f0 = c / (pi * D * sqrt(1 + (L / (pi * D))^2))`
- **inputImpedance:** `Z_in = 140 * (D / lambda)^2 * (1 + 0.2 * (D / lambda)^2)`
- **gain:** `G = 10 * log10(15 * (D / lambda)^2 * L / lambda * sin^2(alpha))`
- **radiationPattern:** `E(theta, phi) = (sin(theta) / (1 + cos(theta))) * exp(j * n * phi)`
- **bandwidth:** `BW = 2 * (f_high - f_low) / f0 = 4 * a / D`

## Mock Solver Hints

- **Impedance Model:** Use method of moments with wire segments and junction analysis for four-element helical structure
- **Radiation Model:** Apply helical antenna theory with quadrature excitation and pattern multiplication for four elements
- **Key Assumptions:**
  - Thin wire approximation valid
  - Perfect ground plane if present
  - Quadrature phase excitation
  - Uniform current distribution along helix
  - Far-field radiation pattern

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', Chapter 9
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', Chapter 8
- Volakis, J.L. 'Antenna Engineering Handbook', Chapter 7
- Kraus, J.D. 'Antennas for All Applications', Chapter 7

