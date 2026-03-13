# Biconical Antenna

**Category:** broadband

## Overview

A biconical antenna consists of two conical conductors positioned apex-to-apex, forming a symmetric structure that provides extremely wide bandwidth operation. The antenna exhibits excellent broadband characteristics due to its frequency-independent geometry and smooth impedance transition from the feed point to free space.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 2 to 6 dBi
- **Bandwidth:** >100%
- **Polarization:** linear
- **Applications:** EMC testing, broadband communications, UWB systems, frequency-independent measurements, antenna calibration, wideband direction finding

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Cone Half-Angle | α | degrees | 30 | 15 - 60 |
| Cone Length | L | m | 0.25 * c / f_min | 0.1 - 2 |
| Feed Gap | g | m | 0.01 * c / f_center | 0.001 - 0.05 |
| Base Diameter | D | m | 2 * L * tan(α * π / 180) | 0.05 - 3 |

## Design Methodology

Design a biconical antenna by determining cone geometry for desired bandwidth and impedance matching, considering the frequency-independent properties of the conical structure.

### Step 1: Determine Operating Bandwidth

Define minimum and maximum frequencies based on application requirements

**Formula:** `BW = (f_max - f_min) / f_center * 100%`

### Step 2: Select Cone Half-Angle

Choose cone angle for desired impedance, typically 30° for 50Ω systems

**Formula:** `Z0 = 120 * ln(cot(α/2)) for small angles`

### Step 3: Calculate Minimum Cone Length

Determine cone length based on lowest operating frequency

**Formula:** `L_min = 0.25 * c / f_min`

### Step 4: Design Feed Gap

Set gap between cone apexes for proper impedance transition

**Formula:** `g = 0.01 * c / f_center`

### Step 5: Calculate Base Diameter

Determine cone base diameter from length and angle

**Formula:** `D = 2 * L * tan(α)`

### Step 6: Verify Impedance Bandwidth

Check VSWR across operating band using transmission line theory

**Formula:** `VSWR = (1 + |Γ|) / (1 - |Γ|)`

## Equations

- **resonantFrequency:** `f_res = c / (4 * L * cos(α)) for dominant mode`
- **inputImpedance:** `Z_in = 120 * ln(cot(α/2)) for α < 45°`
- **gain:** `G = 1.64 / sin²(α) for small cone angles`
- **radiationPattern:** `E(θ) = sin(θ) / (1 - cos(θ) * cos(α)) for θ > α`
- **bandwidth:** `BW = f_max / f_min = (L * tan(α)) / (g + L * tan(α))`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with tapered impedance transformation from feed gap to cone base, accounting for frequency-dependent effects
- **Radiation Model:** Apply method of moments with triangular basis functions on conical surfaces, or use spherical wave expansion for far-field patterns
- **Key Assumptions:**
  - Perfect electric conductor surfaces
  - Thin wire feed at apex gap
  - Far-field approximation for radiation patterns
  - Frequency-independent geometry scaling

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 9
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 8
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 6
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Chapter 12

