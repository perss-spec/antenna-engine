# Uniform Linear Array

**Category:** array

## Overview

A uniform linear array consists of identical antenna elements arranged in a straight line with equal spacing and uniform amplitude/phase excitation. This configuration provides directional radiation patterns with controllable beamwidth and sidelobe levels through proper element spacing and excitation.

- **Frequency Range:** 30000000 - 300000000000 Hz
- **Typical Gain:** 3 to 25 dBi
- **Bandwidth:** 10-30%
- **Polarization:** linear
- **Applications:** Radar systems, Wireless communications, Radio astronomy, Direction finding, Beamforming networks, Base station antennas

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Number of Elements | N | dimensionless | 4 | 2 - 100 |
| Element Spacing | d | m | 0.5 * lambda | 0.25 - 1 |
| Array Length | L | m | (N-1) * d | 0.5 - 50 |
| Progressive Phase Shift | beta | radians | 0 | -3.14159 - 3.14159 |

## Design Methodology

Design process involves selecting element type, determining spacing for desired radiation characteristics, calculating excitation coefficients, and optimizing for specific performance requirements.

### Step 1: Element Selection

Choose appropriate radiating element based on frequency and polarization requirements

**Formula:** `f_element = f_operating`

### Step 2: Spacing Determination

Set element spacing to avoid grating lobes while achieving desired beamwidth

**Formula:** `d <= lambda / (1 + |sin(theta_max)|)`

### Step 3: Array Factor Calculation

Compute array factor for uniform amplitude and progressive phase

**Formula:** `AF = sin(N*psi/2) / (N*sin(psi/2))`

### Step 4: Beamwidth Estimation

Calculate half-power beamwidth for broadside radiation

**Formula:** `HPBW = 0.886 * lambda / L`

### Step 5: Directivity Calculation

Determine maximum directivity for uniform illumination

**Formula:** `D = 2*L/lambda`

### Step 6: Impedance Matching

Design feed network to match array impedance to transmission line

**Formula:** `Z_array = Z_element / N`

### Step 7: Sidelobe Optimization

Apply amplitude tapering if lower sidelobes are required

**Formula:** `SLL = -13.26 dB (uniform)`

## Equations

- **resonantFrequency:** `f_r = c / lambda_element`
- **inputImpedance:** `Z_in = Z_element / N + j*X_mutual`
- **gain:** `G = eta * D = eta * 2*L/lambda`
- **radiationPattern:** `E(theta) = E_element(theta) * sin(N*psi/2) / (N*sin(psi/2))`
- **bandwidth:** `BW = BW_element * sqrt(1 - (d*sin(theta)/lambda)^2)`

## Mock Solver Hints

- **Impedance Model:** Use mutual coupling matrix with self and mutual impedances between elements, account for feed network transformation
- **Radiation Model:** Pattern multiplication of element pattern and array factor, include mutual coupling effects on element patterns
- **Key Assumptions:**
  - Identical elements
  - Linear arrangement
  - Far-field approximation
  - Uniform excitation amplitude
  - Progressive phase shift for beam steering

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 6
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 7
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 11
- Pozar, D.M. 'Microwave Engineering', 4th Edition, Chapter 12

