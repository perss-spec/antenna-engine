# Circular Microstrip Patch

**Category:** microstrip

## Overview

A circular microstrip patch antenna consists of a circular conducting patch printed on a grounded dielectric substrate. It radiates primarily in the broadside direction with moderate gain and is widely used in wireless communication systems due to its low profile, light weight, and ease of fabrication.

- **Frequency Range:** 100000000 - 100000000000 Hz
- **Typical Gain:** 3 to 9 dBi
- **Bandwidth:** 1-5%
- **Polarization:** linear
- **Applications:** GPS receivers, WiFi systems, Bluetooth devices, RFID tags, Mobile communications, Satellite communications, Wireless sensor networks

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Patch Radius | a | m | 0.293 * c / (f * sqrt(εr)) | 0.001 - 0.1 |
| Substrate Thickness | h | m | 0.05 * λ0 / sqrt(εr) | 0.0001 - 0.01 |
| Relative Permittivity | εr | dimensionless | 4.4 | 1 - 12 |
| Loss Tangent | tan(δ) | dimensionless | 0.02 | 0.0001 - 0.1 |
| Feed Position | rf | m | 0.5 * a | 0 - 1 |

## Design Methodology

Design process involves calculating the patch radius for resonance, determining substrate parameters, positioning the feed for impedance matching, and optimizing for desired bandwidth and radiation characteristics.

### Step 1: Calculate Effective Radius

Determine the effective radius accounting for fringing fields

**Formula:** `ae = a * sqrt(1 + (2*h)/(π*a*εr) * (ln(π*a/(2*h)) + 1.7726))`

### Step 2: Design Physical Radius

Calculate physical patch radius for desired resonant frequency

**Formula:** `a = F / (2 * fr * sqrt(εr) * sqrt(μ0 * ε0))`

### Step 3: Determine Substrate Height

Select substrate thickness for desired bandwidth and efficiency

**Formula:** `h = 0.3 * c / (2 * π * fr * sqrt(εr))`

### Step 4: Calculate Feed Position

Position coaxial feed for 50-ohm input impedance

**Formula:** `rf = a * sqrt(Rin / 200)`

### Step 5: Compute Radiation Conductance

Calculate radiation conductance for efficiency analysis

**Formula:** `Gr = (k0^4 * a^4) / (6 * π * η0)`

### Step 6: Verify Bandwidth

Check fractional bandwidth meets requirements

**Formula:** `BW = (2 * h * sqrt(εr)) / (π * a * Q)`

## Equations

- **resonantFrequency:** `fr = (1.8412 * c) / (2 * π * ae * sqrt(εr))`
- **inputImpedance:** `Zin = 1 / (Gr + jBr + Gd + jBd)`
- **gain:** `G = (2 * π * ae^2 * k0^2) / (3 * λ0^2) * (1 - (k0*h)^2/24)`
- **radiationPattern:** `E(θ,φ) = (j * k0 * h * V0 * ae * J1(k0*ae*sin(θ))) / (2 * r * sin(θ))`
- **bandwidth:** `BW = 3.77 * (εr - 1) / εr^2 * (h/λ0) * (ae/h)`

## Mock Solver Hints

- **Impedance Model:** cavity_model_with_fringing_fields
- **Radiation Model:** magnetic_current_aperture_integration
- **Key Assumptions:**
  - TM11 dominant mode
  - Perfect electric conductor patch
  - Infinite ground plane
  - Thin substrate approximation
  - Negligible surface waves

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition
- Pozar, D.M. 'Microwave Engineering', 4th Edition
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition

