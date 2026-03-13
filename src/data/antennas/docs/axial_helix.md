# Axial Mode Helical (wire)

**Category:** wire

## Overview

A helical antenna operating in axial mode where the circumference is approximately one wavelength, producing circularly polarized radiation along the helix axis. The antenna consists of a wire wound in a helical coil above a ground plane, providing excellent circular polarization and moderate gain.

- **Frequency Range:** 100000000 - 10000000000 Hz
- **Typical Gain:** 10 to 20 dBi
- **Bandwidth:** 40-60%
- **Polarization:** circular
- **Applications:** Satellite communications, GPS receivers, Telemetry systems, Space communications, Circular polarization applications, Tracking antennas

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Circumference | C | m | c/f | 0.8 - 1.2 |
| Pitch Angle | α | degrees | 12 + 0.2*N | 10 - 20 |
| Number of Turns | N | dimensionless | f_max/f_min | 3 - 20 |
| Wire Diameter | d | m | 0.01*c/f | 0.001 - 0.1 |
| Ground Plane Diameter | Dg | m | 1.2*c/f | 0.7 - 2 |
| Turn Spacing | S | m | C*tan(α)/2π | 0.1 - 0.4 |

## Design Methodology

Design process involves determining the helical dimensions for axial mode operation, ensuring proper impedance matching and circular polarization characteristics.

### Step 1: Determine Operating Frequency

Select center frequency and bandwidth requirements

**Formula:** `f0 = (f_min + f_max)/2`

### Step 2: Calculate Circumference

Set circumference to approximately one wavelength at center frequency

**Formula:** `C = c/f0`

### Step 3: Determine Number of Turns

Calculate turns based on desired gain and bandwidth

**Formula:** `N = 15*C*S/λ²`

### Step 4: Calculate Pitch Angle

Determine optimal pitch angle for axial mode operation

**Formula:** `α = arctan(S*2π/C)`

### Step 5: Size Ground Plane

Design ground plane for proper radiation characteristics

**Formula:** `Dg = 1.2*λ`

### Step 6: Select Wire Diameter

Choose wire diameter for mechanical stability and bandwidth

**Formula:** `d = λ/100 to λ/50`

### Step 7: Calculate Input Impedance

Determine feed point impedance for matching network design

**Formula:** `Zin = 140*C/λ`

## Equations

- **resonantFrequency:** `f0 = c/C where C is circumference`
- **inputImpedance:** `Zin = 140*C/λ ohms`
- **gain:** `G = 15*N*C²*S/λ³ (dimensionless)`
- **radiationPattern:** `E(θ) = sin(θ)*exp(-j*k*z*cos(θ)) for axial direction`
- **bandwidth:** `BW = 1.2*C/λ - 0.8 (fractional)`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with helical geometry corrections and ground plane effects
- **Radiation Model:** Apply Hansen-Woodyard condition for endfire array with helical phase progression
- **Key Assumptions:**
  - Axial mode operation (C ≈ λ)
  - Perfect ground plane
  - Uniform current distribution
  - Far-field approximation
  - Lossless conductor

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', Chapter 9
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', Chapter 8
- Kraus, J.D. 'Antennas for All Applications', Chapter 7
- Volakis, J.L. 'Antenna Engineering Handbook', Chapter 5

