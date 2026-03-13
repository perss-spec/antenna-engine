# Yagi-Uda Array

**Category:** wire

## Overview

A directional antenna array consisting of a driven element (typically a dipole) with one or more parasitic elements including reflectors and directors. The parasitic elements are not directly connected to the transmission line but are electromagnetically coupled to the driven element, creating a highly directional radiation pattern with significant forward gain.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 6 to 20 dBi
- **Bandwidth:** 5-15%
- **Polarization:** linear
- **Applications:** Television reception, Amateur radio, Point-to-point communication, Radar systems, Wireless communication, Satellite communication

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Driven Element Length | Ld | m | 0.47 * lambda | 0.4 - 0.5 |
| Reflector Length | Lr | m | 0.49 * lambda | 0.48 - 0.52 |
| Director Length | Ldir | m | 0.45 * lambda | 0.4 - 0.47 |
| Reflector Spacing | Sr | m | 0.25 * lambda | 0.15 - 0.35 |
| Director Spacing | Sd | m | 0.2 * lambda | 0.1 - 0.35 |
| Wire Radius | a | m | 0.001 * lambda | 0.0005 - 0.01 |
| Number of Directors | N | dimensionless | 3 | 1 - 20 |

## Design Methodology

Design process involves determining element lengths and spacings to achieve desired gain and impedance matching through electromagnetic coupling optimization.

### Step 1: Determine Operating Frequency

Calculate free-space wavelength and establish design frequency

**Formula:** `lambda = c / f`

### Step 2: Design Driven Element

Set driven element length for resonance, accounting for mutual coupling effects

**Formula:** `Ld = 0.47 * lambda`

### Step 3: Position and Size Reflector

Place reflector behind driven element with appropriate length for maximum reflection

**Formula:** `Lr = 1.05 * Ld, Sr = 0.25 * lambda`

### Step 4: Design Director Elements

Size directors shorter than driven element for forward wave enhancement

**Formula:** `Ldir = 0.95 * Ld`

### Step 5: Optimize Director Spacing

Space directors for constructive interference in forward direction

**Formula:** `Sd = 0.2 * lambda to 0.35 * lambda`

### Step 6: Calculate Input Impedance

Determine impedance including mutual coupling effects between elements

**Formula:** `Zin = Zself + sum(Zmutual)`

### Step 7: Optimize for Gain and SWR

Fine-tune element lengths and spacings for maximum gain and acceptable SWR

**Formula:** `Gain = 10*log10(4*pi*U_max/P_rad)`

## Equations

- **resonantFrequency:** `f0 = c / (2 * Ld_eff) where Ld_eff accounts for end effects and coupling`
- **inputImpedance:** `Zin = R11 + j*X11 + sum(Z1n * In/I1) for n parasitic elements`
- **gain:** `G = 4*pi*U_max/P_total where U_max is maximum radiation intensity`
- **radiationPattern:** `E(theta,phi) = j*k*I*exp(-j*k*r)/(4*pi*r) * [cos(k*L*cos(theta)/2) - cos(k*L/2)]/sin(theta)`
- **bandwidth:** `BW = 2*(f2-f1)/f0 where SWR < 2:1`

## Mock Solver Hints

- **Impedance Model:** Method of moments with mutual impedance matrix Z_mn = R_mn + j*X_mn between elements
- **Radiation Model:** Superposition of individual element patterns with proper phase relationships from mutual coupling
- **Key Assumptions:**
  - Thin wire approximation valid for length/diameter > 100
  - Elements parallel and in same plane
  - Sinusoidal current distribution on each element
  - Far-field radiation pattern calculation
  - Linear polarization maintained

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 10
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 7
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 10
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Chapter 14

