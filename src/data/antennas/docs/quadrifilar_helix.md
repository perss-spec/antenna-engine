# Quadrifilar Helix Antenna

**Category:** wire

## Overview

A four-wire helical antenna wound in a helical configuration with 90-degree phase differences between adjacent elements. Provides excellent circular polarization characteristics and hemispherical coverage patterns. Commonly used for satellite communications and GPS applications due to its compact size and broad beamwidth.

- **Frequency Range:** 100000000 - 10000000000 Hz
- **Typical Gain:** 0 to 8 dBi
- **Bandwidth:** 10-20%
- **Polarization:** circular
- **Applications:** Satellite communications, GPS receivers, Mobile satellite terminals, Telemetry systems, RFID readers, Handheld radios

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Helix Diameter | D | m | lambda / (pi * sqrt(2)) | 0.05 - 0.5 |
| Helix Length | L | m | lambda / 4 | 0.1 - 2 |
| Pitch Angle | alpha | degrees | atan(pitch / (pi * D)) | 5 - 30 |
| Wire Diameter | a | m | lambda / 200 | 0.0001 - 0.01 |
| Ground Plane Diameter | Dg | m | lambda / 2 | 0.1 - 1 |
| Number of Turns | N | dimensionless | 0.25 | 0.125 - 2 |

## Design Methodology

Design process involves determining helix geometry for desired frequency, calculating feed network for quadrature phasing, optimizing for circular polarization purity, and matching to desired impedance.

### Step 1: Determine Operating Frequency and Wavelength

Calculate free-space wavelength and establish design frequency

**Formula:** `lambda = c / f`

### Step 2: Calculate Helix Diameter

Set helix diameter for optimal radiation characteristics

**Formula:** `D = lambda / (pi * sqrt(2))`

### Step 3: Determine Helix Length and Pitch

Calculate axial length and pitch angle for quarter-wave resonance

**Formula:** `L = lambda / 4, pitch = L / N`

### Step 4: Design Feed Network

Create 90-degree hybrid network for quadrature feeding

**Formula:** `Phase_n = n * 90 degrees, n = 0,1,2,3`

### Step 5: Calculate Input Impedance

Determine individual element impedance and feed network matching

**Formula:** `Z_in = 140 * (D/lambda) * sqrt(1 + (pitch/(pi*D))^2)`

### Step 6: Optimize Ground Plane Size

Size ground plane for desired front-to-back ratio

**Formula:** `Dg >= lambda / 2`

### Step 7: Verify Circular Polarization

Check axial ratio and adjust geometry if needed

**Formula:** `AR = 20 * log10((E_max + E_min)/(E_max - E_min))`

## Equations

- **resonantFrequency:** `f_r = c / (pi * sqrt(D^2 + (pitch)^2))`
- **inputImpedance:** `Z_in = 140 * (D/lambda) * sqrt(1 + (pitch/(pi*D))^2)`
- **gain:** `G = 10 * log10(4 * pi * D^2 / lambda^2) + 3`
- **radiationPattern:** `E(theta,phi) = (sin(theta) * cos(phi + n*pi/2)) * exp(-j*k*r)`
- **bandwidth:** `BW = 2 * (f_high - f_low) / f_center`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with helical geometry corrections and mutual coupling between elements
- **Radiation Model:** Apply superposition of four helical elements with 90-degree phase progression and pattern multiplication
- **Key Assumptions:**
  - Small pitch angle approximation
  - Uniform current distribution along helix
  - Negligible mutual coupling between non-adjacent elements
  - Perfect ground plane reflection
  - Thin wire approximation valid

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 9
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 8
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 7
- Kraus, J.D. and Marhefka, R.J., 'Antennas for All Applications', 3rd Edition

