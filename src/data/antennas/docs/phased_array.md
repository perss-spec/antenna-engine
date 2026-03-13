# Phased Array

**Category:** array

## Overview

A phased array antenna consists of multiple radiating elements with controllable phase relationships to electronically steer the beam direction without physical movement. The array can achieve high gain, narrow beamwidth, and rapid beam scanning through precise phase control of individual elements.

- **Frequency Range:** 100000000 - 100000000000 Hz
- **Typical Gain:** 15 to 50 dBi
- **Bandwidth:** 10-30%
- **Polarization:** linear
- **Applications:** radar systems, satellite communications, 5G base stations, electronic warfare, space communications, weather radar, phased array radar

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Number of Elements | N | dimensionless | 16 | 4 - 10000 |
| Element Spacing | d | m | 0.5 * lambda | 0.3 - 1 |
| Scan Angle | theta_s | degrees | 60 | 0 - 90 |
| Progressive Phase Shift | beta | radians | 2*pi*d*sin(theta_s)/lambda | -3.14159 - 3.14159 |
| Array Length | L | m | (N-1)*d | 0.1 - 100 |
| Amplitude Taper Coefficient | a_n | dimensionless | 1.0 | 0.1 - 1 |

## Design Methodology

Phased array design involves determining element type, spacing, number of elements, and feed network configuration to meet gain, beamwidth, and scanning requirements while maintaining acceptable impedance matching and sidelobe levels.

### Step 1: Determine Array Requirements

Specify gain, beamwidth, scan range, and frequency band requirements

**Formula:** `G_req = 10*log10(4*pi*A_eff/lambda^2)`

### Step 2: Calculate Number of Elements

Estimate required number of elements based on gain and aperture size

**Formula:** `N = G_linear/(G_element * eta_array)`

### Step 3: Set Element Spacing

Choose spacing to avoid grating lobes within scan range

**Formula:** `d <= lambda/(1 + sin(theta_max))`

### Step 4: Design Array Geometry

Arrange elements in linear, planar, or conformal configuration

**Formula:** `L_array = (N-1)*d for linear array`

### Step 5: Calculate Phase Shifts

Determine progressive phase shift for desired beam direction

**Formula:** `beta_n = n * k * d * sin(theta_s)`

### Step 6: Apply Amplitude Tapering

Design amplitude distribution to control sidelobe levels

**Formula:** `a_n = Taylor_window(n, N, SLL_dB)`

### Step 7: Design Feed Network

Create corporate or series feed network with required phase shifts

**Formula:** `Z_feed = Z0/sqrt(N) for corporate feed`

### Step 8: Analyze Mutual Coupling

Account for coupling effects between adjacent elements

**Formula:** `Z_active = Z_self + sum(Z_mn * I_n/I_m)`

## Equations

- **resonantFrequency:** `f0 = c/(2*L_element) for individual elements`
- **inputImpedance:** `Z_in = Z_element + Z_mutual + Z_feed`
- **gain:** `G = 10*log10(N * G_element * eta_array * cos^q(theta))`
- **radiationPattern:** `AF(theta) = sum(a_n * exp(j*n*(k*d*sin(theta) - beta)))`
- **bandwidth:** `BW = 2*(f_max - f_min)/f_center`

## Mock Solver Hints

- **Impedance Model:** Use active impedance matrix including mutual coupling between elements with Z_mn = R_mn + j*X_mn
- **Radiation Model:** Multiply element pattern by array factor: E_total(theta,phi) = E_element(theta,phi) * AF(theta,phi)
- **Key Assumptions:**
  - uniform element patterns
  - linear phase progression
  - far-field approximation
  - negligible higher-order coupling

## References

- Balanis "Antenna Theory: Analysis and Design" Chapter 6
- Stutzman & Thiele "Antenna Theory and Design" Chapter 11
- Mailloux "Phased Array Antenna Handbook"
- Hansen "Phased Array Antennas"

