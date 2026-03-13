# Archimedean Spiral

**Category:** broadband

## Overview

A frequency-independent spiral antenna where the radius increases linearly with angle, providing broadband operation with circular polarization. The self-complementary structure maintains constant impedance and radiation characteristics over multiple octaves. Widely used in applications requiring ultra-wideband performance with circular polarization.

- **Frequency Range:** 100000000 - 18000000000 Hz
- **Typical Gain:** 3 to 8 dBi
- **Bandwidth:** >100%
- **Polarization:** circular
- **Applications:** EMC testing, Direction finding, Broadband communications, Radar systems, Electronic warfare, Satellite communications, Ultra-wideband systems

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Outer Radius | r_out | m | lambda_min / (2 * pi) | 0.01 - 1 |
| Inner Radius | r_in | m | lambda_max / (2 * pi) | 0.001 - 0.1 |
| Growth Rate | a | m/rad | (r_out - r_in) / (2 * pi * N) | 0.0001 - 0.01 |
| Number of Turns | N | dimensionless | log10(f_max/f_min) | 1 - 10 |
| Arm Width | w | m | 0.1 * lambda_max | 0.0001 - 0.01 |
| Arm Spacing | s | m | w | 0.0001 - 0.01 |

## Design Methodology

Design process involves determining spiral dimensions based on frequency requirements, ensuring self-complementary geometry for constant impedance, and optimizing the feeding structure for broadband matching.

### Step 1: Frequency Range Specification

Define the required operating frequency range and calculate corresponding wavelengths

**Formula:** `lambda_min = c / f_min, lambda_max = c / f_max`

### Step 2: Outer Radius Calculation

Calculate outer radius based on lowest frequency for proper radiation

**Formula:** `r_out = lambda_min / (2 * pi)`

### Step 3: Inner Radius Calculation

Calculate inner radius based on highest frequency and practical constraints

**Formula:** `r_in = lambda_max / (2 * pi)`

### Step 4: Growth Rate Determination

Calculate the growth rate parameter for the Archimedean spiral

**Formula:** `a = (r_out - r_in) / (2 * pi * N)`

### Step 5: Self-Complementary Design

Set arm width and spacing equal for self-complementary structure

**Formula:** `w = s = 0.1 * lambda_max`

### Step 6: Impedance Matching

Design balun or feeding structure for 50-ohm impedance matching

**Formula:** `Z_spiral = 188.5 ohms (self-complementary)`

### Step 7: Substrate Selection

Choose substrate thickness and dielectric constant for optimal performance

**Formula:** `h = 0.05 * lambda_max, epsilon_r = 2.2 to 10`

## Equations

- **resonantFrequency:** `f = c / (2 * pi * r) for each radius point`
- **inputImpedance:** `Z_in = 188.5 ohms (self-complementary structure)`
- **gain:** `G = 4 + 10*log10(f/f_min) dBi (approximate)`
- **radiationPattern:** `E_theta = (j*k*r*exp(-j*k*r))/(4*pi*r) * [cos(phi/2) - cos(3*phi/2)]`
- **bandwidth:** `BW = (f_max - f_min) / f_center * 100%`

## Mock Solver Hints

- **Impedance Model:** Use self-complementary theory with Z0 = 188.5 ohms, apply balun transformation to 50 ohms
- **Radiation Model:** Frequency-independent pattern with circular polarization, use active region concept at circumference = wavelength
- **Key Assumptions:**
  - Self-complementary structure
  - Infinite ground plane
  - Perfect conductor
  - Active region dominates radiation
  - Frequency-independent behavior

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 14
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 12
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 14
- Kraus, J.D. 'Antennas for All Applications', 3rd Edition, Chapter 13

