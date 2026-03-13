# Yagi-Uda Array

**Category:** wire

## Overview

A directional antenna array consisting of a driven element (typically a dipole) and multiple parasitic elements including reflectors and directors. The parasitic elements are not directly connected to the transmission line but are electromagnetically coupled to the driven element, creating a highly directional radiation pattern with significant forward gain.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 6 to 20 dBi
- **Bandwidth:** 5-15%
- **Polarization:** linear
- **Applications:** Television reception, Amateur radio, Point-to-point communication, Radar systems, Wireless communication, Satellite communication

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Driven Element Length | L_d | m | 0.47 * lambda | 0.4 - 0.5 |
| Reflector Length | L_r | m | 0.49 * lambda | 0.48 - 0.52 |
| Director Length | L_dir | m | 0.43 * lambda | 0.35 - 0.45 |
| Reflector Spacing | S_r | m | 0.25 * lambda | 0.15 - 0.35 |
| Director Spacing | S_d | m | 0.2 * lambda | 0.1 - 0.35 |
| Wire Radius | a | m | 0.001 * lambda | 0.0001 - 0.01 |
| Number of Directors | N_d | dimensionless | 3 | 1 - 20 |

## Design Methodology

Design process involves optimizing element lengths and spacings to achieve desired gain and impedance matching through electromagnetic coupling between parasitic elements.

### Step 1: Determine Operating Frequency

Calculate free-space wavelength and establish design frequency

**Formula:** `lambda = c / f`

### Step 2: Design Driven Element

Set driven element length for resonance, accounting for mutual coupling effects

**Formula:** `L_d = 0.47 * lambda`

### Step 3: Position and Size Reflector

Place reflector behind driven element with appropriate length for maximum reflection

**Formula:** `L_r = 0.49 * lambda, S_r = 0.25 * lambda`

### Step 4: Design Director Elements

Size and position directors for progressive phase shift and beam focusing

**Formula:** `L_dir = 0.43 * lambda, S_d = 0.2 * lambda`

### Step 5: Optimize Element Spacing

Adjust spacings to maximize forward gain while maintaining impedance match

**Formula:** `S_opt = 0.15 * lambda + 0.1 * lambda * n`

### Step 6: Calculate Input Impedance

Determine driving point impedance considering mutual coupling between all elements

**Formula:** `Z_in = R_in + j*X_in`

### Step 7: Verify Radiation Pattern

Calculate directivity and front-to-back ratio to confirm performance

**Formula:** `D = 4*pi*U_max / P_rad`

## Equations

- **resonantFrequency:** `f_r = c / (2 * L_eff) where L_eff accounts for end effects and coupling`
- **inputImpedance:** `Z_in = V_1 / I_1 = Z_11 + sum(Z_1n * I_n / I_1) for n = 2 to N`
- **gain:** `G = D * eta where D = 4*pi / (integral of |F(theta,phi)|^2 over 4*pi)`
- **radiationPattern:** `E(theta,phi) = sum(I_n * exp(-j*k*r_n*cos(theta)) * f_n(theta,phi)) for all elements n`
- **bandwidth:** `BW = 2 * (f_2 - f_1) / f_0 where VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** Method of moments with mutual impedance matrix Z_mn between elements m and n
- **Radiation Model:** Superposition of individual element patterns with appropriate phase relationships
- **Key Assumptions:**
  - Thin wire approximation valid for wire radius << wavelength
  - Ground plane effects negligible for elevated arrays
  - Linear current distribution approximation on each element
  - Far-field radiation pattern calculation
  - Lossless conductors assumed for gain calculations

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 10
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 7
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 11
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Chapter 14

