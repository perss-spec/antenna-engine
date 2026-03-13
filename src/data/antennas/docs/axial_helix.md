# Axial Helix Antenna (wire)

**Category:** wire

## Overview

A helical antenna operating in axial mode where the helix circumference is approximately one wavelength, producing circularly polarized radiation along the helix axis. The antenna consists of a wire wound in a helical coil above a ground plane, providing excellent circular polarization purity and moderate gain.

- **Frequency Range:** 100000000 - 10000000000 Hz
- **Typical Gain:** 10 to 18 dBi
- **Bandwidth:** 20-50%
- **Polarization:** circular
- **Applications:** Satellite communications, GPS receivers, Telemetry systems, Space communications, Radio astronomy, Circular polarization applications

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Helix Circumference | C | m | C = λ | 0.8 - 1.3 |
| Pitch Angle | α | degrees | α = arctan(S/(π*D)) | 12 - 14 |
| Turn Spacing | S | m | S = λ/4 | 0.2 - 0.3 |
| Helix Diameter | D | m | D = λ/π | 0.25 - 0.4 |
| Number of Turns | N | dimensionless | N = 6 to 12 | 3 - 20 |
| Wire Diameter | a | m | a = λ/100 | 0.005 - 0.02 |
| Ground Plane Diameter | Dg | m | Dg = λ | 0.75 - 2 |

## Design Methodology

Design process for axial mode helical antenna involves determining helix dimensions for desired frequency, calculating number of turns for required gain, and optimizing impedance matching.

### Step 1: Determine Operating Frequency and Wavelength

Calculate free space wavelength at the center frequency

**Formula:** `λ = c/f`

### Step 2: Calculate Helix Circumference

Set circumference close to one wavelength for axial mode operation

**Formula:** `C = λ, D = C/π = λ/π`

### Step 3: Determine Turn Spacing and Pitch Angle

Calculate spacing for optimal circular polarization, typically λ/4

**Formula:** `S = λ/4, α = arctan(S/(π*D)) ≈ 13°`

### Step 4: Calculate Number of Turns

Determine turns based on desired gain and bandwidth requirements

**Formula:** `G(dBi) ≈ 10*log10(15*N*S²/λ²), N = 6 to 12 typical`

### Step 5: Design Ground Plane

Size ground plane for proper reflection and pattern control

**Formula:** `Dg ≥ λ for good performance`

### Step 6: Calculate Input Impedance

Estimate impedance for matching network design

**Formula:** `Zin ≈ 140*(C/λ) ohms`

### Step 7: Optimize Wire Diameter

Select wire diameter for mechanical stability and bandwidth

**Formula:** `a = λ/100 to λ/50 for good bandwidth`

## Equations

- **resonantFrequency:** `f = c/λ where C ≈ λ`
- **inputImpedance:** `Zin ≈ 140*(C/λ) ohms`
- **gain:** `G(dBi) ≈ 10*log10(15*N*S²/λ²)`
- **radiationPattern:** `E(θ) ∝ sin(θ)*exp(-j*N*π*cos(θ)*S/λ)`
- **bandwidth:** `BW ≈ 2*(a/λ)*100% for VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with helical geometry corrections and ground plane effects
- **Radiation Model:** Apply Hansen-Woodyard condition with helical current distribution and axial mode assumptions
- **Key Assumptions:**
  - Axial mode operation with C ≈ λ
  - Uniform current distribution along helix
  - Perfect ground plane reflection
  - Far-field approximation for radiation pattern
  - Circular polarization in axial direction

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 10
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 8
- Kraus, J.D., 'Antennas for All Applications', 3rd Edition, Chapter 7
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 5

