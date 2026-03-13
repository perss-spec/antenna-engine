# Pyramidal Horn

**Category:** aperture

## Overview

A pyramidal horn antenna is a flared waveguide structure that provides a smooth transition from a rectangular waveguide to free space. It features flaring in both E-plane and H-plane dimensions, creating a pyramidal shape that improves impedance matching and directivity compared to an open waveguide. The horn provides moderate to high gain with good impedance matching over a wide frequency range.

- **Frequency Range:** 1000000000 - 100000000000 Hz
- **Typical Gain:** 10 to 25 dBi
- **Bandwidth:** 30-50%
- **Polarization:** linear
- **Applications:** Microwave communication systems, Radar antennas, Satellite ground stations, Feed horns for reflector antennas, EMC testing, Radio astronomy, Microwave measurement systems

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Waveguide Width | a | m | 0.7 * lambda | 0.5 - 1.2 |
| Waveguide Height | b | m | 0.35 * lambda | 0.25 - 0.6 |
| Horn Aperture Width | A | m | 3 * lambda | 1.5 - 10 |
| Horn Aperture Height | B | m | 2.5 * lambda | 1.2 - 8 |
| E-plane Horn Length | L1 | m | (A^2 - a^2) / (8 * lambda) | 1 - 20 |
| H-plane Horn Length | L2 | m | (B^2 - b^2) / (8 * lambda) | 1 - 20 |
| E-plane Flare Angle | θE | degrees | atan((A - a) / (2 * L1)) * 180 / pi | 5 - 30 |
| H-plane Flare Angle | θH | degrees | atan((B - b) / (2 * L2)) * 180 / pi | 5 - 30 |

## Design Methodology

Design of pyramidal horn antennas involves determining optimal aperture dimensions and horn lengths to achieve desired gain and beamwidth while maintaining good impedance matching. The design balances aperture efficiency against phase error from the horn geometry.

### Step 1: Determine Operating Frequency and Waveguide Dimensions

Select the operating frequency and corresponding rectangular waveguide dimensions for the dominant TE10 mode

**Formula:** `a = 0.7 * lambda, b = 0.35 * lambda, fc = c / (2 * a)`

### Step 2: Calculate Desired Gain and Aperture Area

Determine the required aperture area based on desired gain using aperture antenna theory

**Formula:** `G = 4 * pi * Aeff / lambda^2, Aeff = eta_ap * A * B`

### Step 3: Optimize E-plane Dimensions

Calculate optimal E-plane aperture width and horn length for maximum gain with acceptable phase error

**Formula:** `A_opt = sqrt(3 * lambda * L1), L1 = (A^2 - a^2) / (8 * lambda)`

### Step 4: Optimize H-plane Dimensions

Calculate optimal H-plane aperture height and horn length for maximum gain with acceptable phase error

**Formula:** `B_opt = sqrt(2 * lambda * L2), L2 = (B^2 - b^2) / (8 * lambda)`

### Step 5: Calculate Flare Angles

Determine the flare angles in both planes to ensure gradual transition and good impedance matching

**Formula:** `theta_E = atan((A - a) / (2 * L1)), theta_H = atan((B - b) / (2 * L2))`

### Step 6: Verify Phase Error and Aperture Efficiency

Check that phase errors are acceptable and calculate aperture efficiency

**Formula:** `delta_E = (A - a)^2 / (8 * lambda * L1), delta_H = (B - b)^2 / (8 * lambda * L2)`

### Step 7: Calculate Radiation Patterns and Gain

Compute the theoretical radiation patterns and gain using aperture field distribution

**Formula:** `G = 32 * A * B / (lambda^2 * theta_E * theta_H), theta_3dB = 51 * lambda / A (E-plane)`

## Equations

- **resonantFrequency:** `fc = c / (2 * a) for TE10 mode cutoff`
- **inputImpedance:** `Z_in ≈ 377 * sqrt(1 - (fc/f)^2) for matched horn`
- **gain:** `G = 32 * A * B / (lambda^2 * theta_E_rad * theta_H_rad) where theta in radians`
- **radiationPattern:** `E_theta = (sin(u)/u) * (sin(v)/v) where u = (pi*A*sin(theta)*cos(phi))/lambda, v = (pi*B*sin(theta)*sin(phi))/lambda`
- **bandwidth:** `BW ≈ 2 * (f - fc) / f for VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with gradual taper approximation, account for TE10 mode propagation and reflection coefficient at aperture
- **Radiation Model:** Apply Huygens principle with uniform amplitude and quadratic phase distribution across aperture, use Fresnel integrals for pattern calculation
- **Key Assumptions:**
  - Dominant TE10 mode propagation
  - Uniform field distribution at aperture
  - Quadratic phase variation across aperture
  - Perfect conductor walls
  - No higher-order mode excitation

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 13
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 11
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Chapter 6
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 15
- Love, A.W., 'Electromagnetic Horn Antennas', IEEE Press, 1976

