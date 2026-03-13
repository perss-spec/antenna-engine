# Discone Antenna

**Category:** broadband

## Overview

A broadband omnidirectional antenna consisting of a disc and cone configuration that provides wide frequency coverage with consistent radiation patterns. The disc acts as a ground plane while the cone serves as the radiating element, creating a vertically polarized antenna with excellent broadband characteristics. Commonly used in applications requiring wide frequency coverage from VHF through microwave frequencies.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 0 to 6 dBi
- **Bandwidth:** >80%
- **Polarization:** linear
- **Applications:** Scanner antennas, Wideband monitoring, EMC testing, Military communications, Frequency hopping systems, Test and measurement

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Disc Diameter | D_disc | m | 0.7 * lambda_max | 0.5 - 1 |
| Cone Base Diameter | D_cone | m | 0.6 * lambda_max | 0.4 - 0.8 |
| Cone Height | H_cone | m | 0.25 * lambda_max | 0.2 - 0.35 |
| Cone Half Angle | alpha | degrees | atan(D_cone / (2 * H_cone)) | 25 - 75 |
| Gap Height | h_gap | m | 0.01 * lambda_max | 0.005 - 0.02 |

## Design Methodology

Design process involves determining optimal disc and cone dimensions based on desired frequency range, calculating cone angle for impedance matching, and optimizing gap spacing for broadband performance.

### Step 1: Determine Operating Frequency Range

Define the lowest and highest operating frequencies to establish wavelength constraints

**Formula:** `lambda_max = c / f_min, lambda_min = c / f_max`

### Step 2: Calculate Disc Diameter

Size the disc to provide adequate ground plane at the lowest frequency

**Formula:** `D_disc = 0.7 * lambda_max`

### Step 3: Determine Cone Dimensions

Calculate cone base diameter and height for optimal impedance matching

**Formula:** `D_cone = 0.6 * lambda_max, H_cone = 0.25 * lambda_max`

### Step 4: Calculate Cone Half Angle

Determine the cone angle that provides 50-ohm impedance match

**Formula:** `alpha = atan(D_cone / (2 * H_cone))`

### Step 5: Set Gap Height

Establish vertical gap between disc and cone for proper feed structure

**Formula:** `h_gap = 0.01 * lambda_max`

### Step 6: Optimize for VSWR

Fine-tune dimensions to achieve VSWR < 2:1 across the band

**Formula:** `VSWR = (1 + |Gamma|) / (1 - |Gamma|)`

## Equations

- **resonantFrequency:** `f_res = c / (4 * H_cone) for fundamental mode`
- **inputImpedance:** `Z_in ≈ 377 * sin(alpha) for small cone angles`
- **gain:** `G(dBi) ≈ 10 * log10(2 * sin²(alpha)) + 2.15`
- **radiationPattern:** `E(theta) = sin(theta) * cos(alpha) for vertical plane`
- **bandwidth:** `BW = (f_max - f_min) / f_center where VSWR < 2:1`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with tapered cone impedance transformation from disc ground plane to free space
- **Radiation Model:** Apply method of moments with triangular surface patches on cone and disc, accounting for edge diffraction effects
- **Key Assumptions:**
  - Perfect conductor assumption for disc and cone
  - Infinite ground plane approximation for disc
  - Linear taper impedance transformation along cone
  - Negligible mutual coupling between disc and cone edges

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 9
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 8
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 15
- Pozar, D.M. 'Microwave Engineering', 4th Edition, Chapter 12

