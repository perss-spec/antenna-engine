# Planar Patch Array

**Category:** array

## Overview

A planar array of microstrip patch antennas arranged in a regular grid pattern to achieve high gain and beam steering capabilities. The array combines multiple patch elements with controlled amplitude and phase distributions to form desired radiation patterns. Commonly used in phased array radar systems, satellite communications, and wireless base stations.

- **Frequency Range:** 1000000000 - 100000000000 Hz
- **Typical Gain:** 15 to 35 dBi
- **Bandwidth:** 2-5%
- **Polarization:** linear
- **Applications:** Phased array radar, Satellite communications, 5G base stations, Point-to-point links, MIMO systems, Beamforming networks

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Patch Length | L | m | c/(2*f*sqrt(εr_eff)) | 0.001 - 0.1 |
| Patch Width | W | m | c/(2*f)*sqrt(2/(εr+1)) | 0.001 - 0.1 |
| Element Spacing X | dx | m | 0.5*c/f | 0.001 - 0.2 |
| Element Spacing Y | dy | m | 0.5*c/f | 0.001 - 0.2 |
| Number of Elements X | Nx | dimensionless | 8 | 2 - 64 |
| Number of Elements Y | Ny | dimensionless | 8 | 2 - 64 |
| Substrate Thickness | h | m | 0.05*c/f | 0.0001 - 0.01 |
| Relative Permittivity | εr | dimensionless | 2.2 | 1.5 - 12 |

## Design Methodology

Design process involves determining individual patch dimensions, optimizing element spacing, calculating feed network, and analyzing array performance including mutual coupling effects.

### Step 1: Calculate Individual Patch Dimensions

Determine patch length and width for resonance at design frequency

**Formula:** `L = c/(2*f*sqrt(εr_eff)), W = c/(2*f)*sqrt(2/(εr+1))`

### Step 2: Determine Element Spacing

Set element spacing to avoid grating lobes while considering mutual coupling

**Formula:** `dx = dy = λ0/2 for broadside radiation, dx,dy < λ0/(1+sin(θmax))`

### Step 3: Calculate Array Factor

Determine array factor for desired beam pattern and side lobe levels

**Formula:** `AF = Σ(m=1 to Nx)Σ(n=1 to Ny) Amn*exp(j*(m*kx*dx + n*ky*dy + φmn))`

### Step 4: Design Feed Network

Design corporate feed network with proper amplitude and phase distribution

**Formula:** `Zin = Z0*sqrt(N) for equal power division, phase shift = k0*d*sin(θ0)`

### Step 5: Account for Mutual Coupling

Calculate mutual coupling between adjacent elements and adjust impedance

**Formula:** `Zin_coupled = Zin_isolated + ΣZmn, where Zmn is mutual impedance`

### Step 6: Calculate Array Gain

Determine total array gain including element gain and array factor

**Formula:** `G_array = G_element * |AF_max|^2 * η_array`

## Equations

- **resonantFrequency:** `fr = c/(2*L*sqrt(εr_eff))`
- **inputImpedance:** `Zin = (Z11 + Z12*I2/I1 + Z13*I3/I1 + ... + Z1N*IN/I1)`
- **gain:** `G = G_element * Nx * Ny * η_array * |AF_normalized|^2`
- **radiationPattern:** `E(θ,φ) = E_element(θ,φ) * AF(θ,φ) = E_element(θ,φ) * Σ(m,n) Amn*exp(j*(m*kx*dx + n*ky*dy))`
- **bandwidth:** `BW = 2*|fr - f|/fr where |S11| < -10dB`

## Mock Solver Hints

- **Impedance Model:** Use method of moments with mutual coupling matrix Z = [Zmn] where Zmn includes self and mutual impedances between elements
- **Radiation Model:** Multiply single element pattern by array factor, account for element pattern degradation due to coupling
- **Key Assumptions:**
  - Infinite ground plane approximation
  - Thin substrate assumption
  - Negligible surface wave effects
  - Linear superposition of element patterns
  - Uniform substrate properties

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 12
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 11
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Chapter 14
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 7

