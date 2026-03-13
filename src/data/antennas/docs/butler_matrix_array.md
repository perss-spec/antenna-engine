# Butler Matrix Array

**Category:** array

## Overview

A Butler matrix array is a beamforming network that uses a matrix of hybrid couplers and phase shifters to create multiple simultaneous beams from an array of antenna elements. The Butler matrix provides orthogonal beams with fixed beam directions, making it ideal for multi-beam applications. This passive beamforming network enables simultaneous reception or transmission in multiple directions without requiring active phase shifters.

- **Frequency Range:** 300000000 - 100000000000 Hz
- **Typical Gain:** 10 to 25 dBi
- **Bandwidth:** 10-20%
- **Polarization:** linear
- **Applications:** satellite communications, radar systems, cellular base stations, direction finding, multi-beam antennas, smart antennas, beamforming networks

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Number of Elements | N | dimensionless | 4 | 4 - 64 |
| Element Spacing | d | m | 0.5 * lambda | 0.4 - 0.8 |
| Coupler Coupling Factor | C | dB | 3 | 3 - 10 |
| Progressive Phase Shift | beta | degrees | 360 / N | 0 - 360 |
| Beam Width | theta_3dB | degrees | 51 * lambda / (N * d) | 10 - 90 |

## Design Methodology

Butler matrix array design involves determining the matrix size, designing hybrid couplers and phase shifters, calculating beam directions, and optimizing the feed network for desired performance.

### Step 1: Determine Matrix Size

Select number of elements N (power of 2) and calculate required matrix size

**Formula:** `Matrix_size = N x N`

### Step 2: Calculate Beam Directions

Determine beam pointing angles for each input port

**Formula:** `theta_m = arcsin(m * lambda / (N * d)) where m = -(N-1)/2 to (N-1)/2`

### Step 3: Design Hybrid Couplers

Design 3dB hybrid couplers with proper coupling and isolation

**Formula:** `S21 = S31 = -j/sqrt(2), S41 = S51 = -1/sqrt(2)`

### Step 4: Calculate Phase Shifts

Determine required phase shifts for each path in the matrix

**Formula:** `phi_mn = (2*pi/N) * m * n where m,n are port indices`

### Step 5: Design Phase Shifters

Implement fixed phase shifters using transmission line lengths

**Formula:** `L_phase = phi * lambda / (2*pi)`

### Step 6: Optimize Feed Network

Minimize insertion loss and maximize isolation between ports

**Formula:** `IL_total = IL_coupler + IL_phase + IL_mismatch`

### Step 7: Verify Beam Orthogonality

Ensure beams are orthogonal and have equal power distribution

**Formula:** `Orthogonality = integral(E_m * E_n * dtheta) = 0 for m != n`

## Equations

- **resonantFrequency:** `f0 = c / (2 * L_coupler * sqrt(epsilon_eff))`
- **inputImpedance:** `Zin = Z0 * sqrt((1 + S11) / (1 - S11))`
- **gain:** `G = 10 * log10(N * D * eta) where D is directivity and eta is efficiency`
- **radiationPattern:** `E(theta) = sum(I_n * exp(j * n * k * d * sin(theta) + j * phi_n)) for n = 1 to N`
- **bandwidth:** `BW = 2 * (f_max - f_min) / f0 where VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** Use scattering parameter matrix analysis for Butler matrix network with hybrid coupler and phase shifter models
- **Radiation Model:** Array factor multiplication with element pattern, considering mutual coupling effects between elements
- **Key Assumptions:**
  - ideal hybrid couplers with perfect isolation
  - lossless phase shifters
  - identical array elements
  - far-field radiation pattern
  - linear array geometry

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 6
- Stutzman, W.L. & Thiele, G.A. 'Antenna Theory and Design', 3rd Edition, Chapter 7
- Pozar, D.M. 'Microwave Engineering', 4th Edition, Chapter 7
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 20

