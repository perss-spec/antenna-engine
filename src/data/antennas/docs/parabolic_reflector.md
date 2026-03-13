# Parabolic Reflector

**Category:** aperture

## Overview

A parabolic reflector antenna consists of a parabolic-shaped conducting surface that focuses electromagnetic waves to or from a feed antenna located at the focal point. The parabolic geometry provides high directivity and gain by creating a uniform phase front across the aperture when illuminated by a point source at the focus.

- **Frequency Range:** 300000000 - 300000000000 Hz
- **Typical Gain:** 20 to 60 dBi
- **Bandwidth:** 10-20%
- **Polarization:** linear
- **Applications:** Satellite communications, Radio astronomy, Radar systems, Point-to-point microwave links, Deep space communications, Radio telescopes

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Reflector Diameter | D | m | 10*lambda | 0.5 - 100 |
| Focal Length | f | m | D/4 | 0.1 - 50 |
| F/D Ratio | f/D | dimensionless | 0.25 | 0.15 - 0.6 |
| Edge Taper | TE | dB | -10 | -20 - -6 |
| Surface Tolerance | δ | m | lambda/16 | 0.0001 - 0.01 |

## Design Methodology

Design process involves selecting reflector geometry, determining feed requirements, optimizing illumination taper, and analyzing performance trade-offs between gain, sidelobe level, and bandwidth.

### Step 1: Determine Aperture Size

Calculate required diameter based on gain specification

**Formula:** `D = sqrt(4*pi*A_eff/lambda^2) where A_eff = 10^(G/10) * lambda^2/(4*pi*eta_ap)`

### Step 2: Select F/D Ratio

Choose focal length to diameter ratio based on feed pattern and blockage constraints

**Formula:** `f/D = 0.25 to 0.4 for typical designs`

### Step 3: Calculate Focal Length

Determine focal point location from reflector vertex

**Formula:** `f = (f/D) * D`

### Step 4: Design Feed Illumination

Select feed pattern to achieve desired edge taper

**Formula:** `theta_0 = 2*atan(D/(4*f)) for edge angle`

### Step 5: Optimize Edge Taper

Balance gain and sidelobe performance through illumination control

**Formula:** `G_max occurs at TE = -8.7 dB for uniform phase`

### Step 6: Calculate Surface Tolerance

Determine manufacturing precision requirements

**Formula:** `delta_rms < lambda/16 for <1dB gain loss`

### Step 7: Analyze Blockage Effects

Account for feed and support structure shadowing

**Formula:** `eta_blockage = 1 - (A_blocked/A_aperture)`

## Equations

- **resonantFrequency:** `Not applicable - broadband aperture antenna`
- **inputImpedance:** `Determined by feed antenna impedance`
- **gain:** `G = eta_ap * (pi*D/lambda)^2 where eta_ap is aperture efficiency`
- **radiationPattern:** `E(theta,phi) = (j*k*exp(-j*k*r)/(4*pi*r)) * integral over aperture of E_aperture(x',y') * exp(j*k*(x'*sin(theta)*cos(phi) + y'*sin(theta)*sin(phi)))`
- **bandwidth:** `BW limited by feed bandwidth and focal point shift with frequency`

## Mock Solver Hints

- **Impedance Model:** Use feed antenna impedance model with reflector coupling effects
- **Radiation Model:** Physical optics aperture integration with Fresnel diffraction corrections
- **Key Assumptions:**
  - Far-field approximation
  - Perfect conductor reflector
  - Geometrical optics ray tracing
  - Uniform aperture phase
  - Negligible edge diffraction for large D/lambda

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', Chapter 15
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', Chapter 12
- Pozar, D.M. 'Microwave Engineering', Chapter 15
- Volakis, J.L. 'Antenna Engineering Handbook', Chapter 17

