# Log-Periodic Dipole Array (wire)

**Category:** wire

## Overview

A frequency-independent antenna consisting of multiple dipole elements arranged in a logarithmic progression of lengths and spacings. The active region shifts along the array as frequency changes, maintaining consistent radiation characteristics over a wide bandwidth. Commonly used for broadband applications requiring stable gain and impedance.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 6 to 12 dBi
- **Bandwidth:** >50%
- **Polarization:** linear
- **Applications:** Television reception, EMC testing, Broadband communications, Direction finding, Spectrum monitoring, Wideband radar

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Scale factor | τ | dimensionless | 0.8 to 0.95 | 0.7 - 0.98 |
| Spacing factor | σ | dimensionless | 0.1 to 0.2 | 0.05 - 0.3 |
| Half apex angle | α | degrees | atan(1/(4*sigma)) | 10 - 45 |
| Number of elements | N | dimensionless | log(f_max/f_min)/log(1/tau) | 5 - 50 |
| Element diameter | d | m | lambda_min/200 | 0.001 - 0.02 |

## Design Methodology

Design process involves selecting scale and spacing factors, calculating element dimensions, and optimizing for desired bandwidth and gain characteristics.

### Step 1: Determine frequency range and bandwidth

Define operating frequency range and calculate required bandwidth ratio

**Formula:** `B = f_max/f_min`

### Step 2: Select design parameters

Choose scale factor tau and spacing factor sigma based on gain and bandwidth requirements

**Formula:** `tau = 0.8 to 0.95, sigma = 0.1 to 0.2`

### Step 3: Calculate number of elements

Determine required number of elements for specified bandwidth

**Formula:** `N = ceil(log(B)/log(1/tau)) + 2`

### Step 4: Calculate element lengths

Compute length of each dipole element using geometric progression

**Formula:** `L_n = L_1 * tau^(n-1), where L_1 = lambda_max/2`

### Step 5: Calculate element spacings

Determine spacing between consecutive elements

**Formula:** `d_n = sigma * L_n`

### Step 6: Design feed system

Design transmission line feed with alternating phase connections

**Formula:** `Z_feed = 200 to 300 ohms, balanced transmission line`

### Step 7: Optimize element diameter

Select appropriate element diameter for mechanical and electrical performance

**Formula:** `d_wire = lambda_min/200 to lambda_min/100`

## Equations

- **resonantFrequency:** `f_n = c/(2*L_n) where L_n = L_1 * tau^(n-1)`
- **inputImpedance:** `Z_in ≈ 200 to 300 ohms (relatively constant over bandwidth)`
- **gain:** `G ≈ 10*log10(sigma*tau/(1-tau)^2) + 3 dBi`
- **radiationPattern:** `E(theta,phi) = sum(I_n * exp(j*k*r_n*cos(theta)) * sin(theta))`
- **bandwidth:** `BW = (1/tau)^N where N is number of active elements`

## Mock Solver Hints

- **Impedance Model:** Use transmission line model with mutual coupling between adjacent elements. Model each dipole as series RLC circuit with coupling matrix.
- **Radiation Model:** Apply superposition of individual dipole radiation patterns with progressive phase shifts. Use method of moments for current distribution.
- **Key Assumptions:**
  - Only 3-5 elements are active at any frequency
  - Elements are thin wire dipoles (length >> diameter)
  - Ground plane effects negligible for elevated mounting
  - Mutual coupling decreases exponentially with element separation
  - Feed line losses are small compared to radiation resistance

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 10
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 8
- Carrel, R., 'The Design of Log-Periodic Dipole Antennas', IRE International Convention Record, 1961
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 14

