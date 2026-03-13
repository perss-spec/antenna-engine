# Folded Dipole

**Category:** wire

## Overview

A folded dipole consists of two parallel conductors connected at their ends, with one conductor fed at the center and the other acting as a parasitic element. This configuration provides higher input impedance (typically 300 ohms) compared to a simple dipole while maintaining similar radiation characteristics. The folded dipole is widely used in applications requiring impedance matching to higher impedance transmission lines.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 2 to 2.2 dBi
- **Bandwidth:** 5-10%
- **Polarization:** linear
- **Applications:** TV antennas, FM radio receivers, VHF/UHF communications, Yagi-Uda array elements, Impedance matching applications

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Total Length | L | m | 0.5 * lambda | 0.45 - 0.55 |
| Conductor Spacing | d | m | 0.01 * lambda | 0.005 - 0.05 |
| Wire Radius | a | m | 0.001 * lambda | 0.0001 - 0.01 |
| Step-up Ratio | n | dimensionless | 4 | 2 - 6 |

## Design Methodology

Design a folded dipole by determining the conductor length for resonance, selecting appropriate spacing and wire radius, calculating the input impedance, and optimizing for the desired frequency response.

### Step 1: Determine Operating Frequency

Select the center frequency and calculate the free-space wavelength

**Formula:** `lambda = c / f`

### Step 2: Calculate Conductor Length

Set the total length of each conductor to approximately half wavelength

**Formula:** `L = 0.5 * lambda * k_eff`

### Step 3: Select Conductor Spacing

Choose spacing between conductors, typically 1-5% of wavelength

**Formula:** `d = 0.01 * lambda to 0.05 * lambda`

### Step 4: Determine Wire Radius

Select wire radius based on bandwidth requirements and mechanical constraints

**Formula:** `a = 0.001 * lambda (typical)`

### Step 5: Calculate Input Impedance

Compute the input impedance using the step-up ratio

**Formula:** `Z_in = n^2 * Z_dipole`

### Step 6: Optimize for Resonance

Adjust length to achieve resonance at the desired frequency

**Formula:** `L_opt = L * (f_target / f_resonant)`

## Equations

- **resonantFrequency:** `f_r = c / (2 * L_eff)`
- **inputImpedance:** `Z_in = (Z_c / 2) * (1 + (Z_c / (2 * Z_dipole)))^2`
- **gain:** `G = 1.64 (same as simple dipole)`
- **radiationPattern:** `E(theta) = cos((pi/2) * cos(theta)) / sin(theta)`
- **bandwidth:** `BW = 2 * sqrt(2 * ln(VSWR) / (pi * Q))`

## Mock Solver Hints

- **Impedance Model:** transmission_line_equivalent_circuit
- **Radiation Model:** method_of_moments_wire_segments
- **Key Assumptions:**
  - thin_wire_approximation
  - sinusoidal_current_distribution
  - far_field_radiation
  - lossless_conductors

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012
- Kraus, J.D. and Marhefka, R.J., 'Antennas for All Applications', 3rd Edition, McGraw-Hill, 2002
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007

