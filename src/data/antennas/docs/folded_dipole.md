# Folded Dipole

**Category:** wire

## Overview

A folded dipole consists of two parallel conductors connected at their ends, with one conductor fed at the center and the other acting as a parasitic element. This configuration provides higher input impedance (typically 300 ohms) compared to a simple dipole while maintaining similar radiation characteristics. The folded dipole is widely used in applications requiring impedance matching to higher impedance transmission lines.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 2 to 2.2 dBi
- **Bandwidth:** 5-10%
- **Polarization:** linear
- **Applications:** FM radio antennas, TV receiving antennas, Yagi-Uda array elements, VHF/UHF communications, RFID readers, Impedance matching applications

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Total Length | L | m | 0.5 * lambda | 0.45 - 0.52 |
| Conductor Spacing | d | m | 0.01 * lambda | 0.005 - 0.05 |
| Wire Radius | a | m | 0.001 * lambda | 0.0005 - 0.01 |
| Step-up Ratio | n | dimensionless | 4 | 2 - 6 |

## Design Methodology

Design process involves determining conductor dimensions, spacing, and feed point configuration to achieve desired impedance and radiation characteristics while maintaining resonance at the operating frequency.

### Step 1: Determine Operating Wavelength

Calculate free-space wavelength at the design frequency

**Formula:** `lambda = c / f`

### Step 2: Calculate Initial Length

Set initial conductor length to half wavelength with velocity factor correction

**Formula:** `L = 0.5 * lambda * k_v`

### Step 3: Determine Conductor Spacing

Choose spacing based on desired impedance and mechanical constraints

**Formula:** `d = 0.01 * lambda to 0.05 * lambda`

### Step 4: Calculate Wire Radius

Select wire radius for practical construction and impedance control

**Formula:** `a = lambda / (2 * pi * 100) to lambda / (2 * pi * 50)`

### Step 5: Compute Input Impedance

Calculate theoretical input impedance using transmission line theory

**Formula:** `Z_in = 4 * Z_dipole * (1 + (d/(2*a))^2)^0.5`

### Step 6: Adjust for End Effects

Apply length correction for finite wire radius and end effects

**Formula:** `L_corrected = L - 2 * a * (ln(L/a) - 2.25)`

## Equations

- **resonantFrequency:** `f_r = c / (2 * L_eff * sqrt(epsilon_eff))`
- **inputImpedance:** `Z_in = 4 * Z_0 * sqrt(1 + (d/(2*a))^2) where Z_0 = 73 ohms`
- **gain:** `G = 1.64 (same as simple dipole)`
- **radiationPattern:** `E(theta) = cos((pi/2)*cos(theta)) / sin(theta)`
- **bandwidth:** `BW = 2 * (f_2 - f_1) / f_0 where VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** transmission_line_equivalent_circuit
- **Radiation Model:** method_of_moments_wire_segments
- **Key Assumptions:**
  - thin_wire_approximation
  - uniform_current_distribution
  - far_field_radiation_pattern
  - lossless_conductors
  - free_space_environment

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012
- Kraus, J.D. and Marhefka, R.J., 'Antennas for All Applications', 3rd Edition, McGraw-Hill, 2002
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007

