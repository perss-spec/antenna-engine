# Log-Periodic Dipole Array (wire)

**Category:** wire

## Overview

A frequency-independent antenna consisting of multiple dipole elements arranged in a logarithmic progression. The elements are fed through a transmission line with alternating phase connections, creating a traveling wave structure that maintains consistent radiation characteristics over a wide frequency range.

- **Frequency Range:** 30000000 - 3000000000 Hz
- **Typical Gain:** 6 to 12 dBi
- **Bandwidth:** >50%
- **Polarization:** linear
- **Applications:** Broadband communications, EMC testing, Television reception, Radio astronomy, Wideband surveillance, Frequency scanning systems

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Scale Factor | τ | dimensionless | 0.8 to 0.9 | 0.7 - 0.95 |
| Spacing Factor | σ | dimensionless | 0.15 to 0.25 | 0.1 - 0.3 |
| Half Apex Angle | α | degrees | atan(sigma/(4*tau)) | 5 - 30 |
| Number of Elements | N | dimensionless | log(f_max/f_min)/log(1/tau) | 5 - 50 |
| Longest Element Length | L1 | meters | 0.5*c/f_min | 0.01 - 10 |
| Characteristic Impedance | Zc | ohms | 120*ln(cot(alpha*pi/180)) | 50 - 300 |

## Design Methodology

Design process involves selecting scale and spacing factors, calculating element dimensions, determining feeder line impedance, and optimizing for desired bandwidth and gain characteristics.

### Step 1: Determine Frequency Range and Scale Factor

Define operating frequency range and select scale factor tau for desired bandwidth

**Formula:** `tau = 0.8 to 0.9 for good performance, B = f_max/f_min`

### Step 2: Calculate Spacing Factor and Apex Angle

Select spacing factor sigma and calculate half apex angle alpha

**Formula:** `sigma = 0.15 to 0.25, alpha = atan(sigma/(4*tau)) * 180/pi`

### Step 3: Determine Number of Elements

Calculate required number of elements based on bandwidth ratio

**Formula:** `N = ceil(log(f_max/f_min)/log(1/tau)) + 2`

### Step 4: Calculate Element Lengths

Determine length of each dipole element using geometric progression

**Formula:** `L_n = L1 * tau^(n-1), where L1 = 0.5*c/f_min`

### Step 5: Calculate Element Spacings

Determine spacing between consecutive elements

**Formula:** `d_n = sigma * L_n = sigma * L1 * tau^(n-1)`

### Step 6: Design Feeder Line

Calculate characteristic impedance of the transmission line feeder

**Formula:** `Zc = 120 * ln(cot(alpha * pi/180))`

### Step 7: Optimize Performance

Fine-tune tau and sigma for desired gain, VSWR, and pattern characteristics

**Formula:** `Adjust tau ± 0.05 and sigma ± 0.02 based on simulation results`

## Equations

- **resonantFrequency:** `f_n = c/(2*L_n) = c/(2*L1*tau^(n-1))`
- **inputImpedance:** `Z_in ≈ Zc * sqrt(tau) for active region`
- **gain:** `G ≈ 10*log10(sigma*tau) + 7.5 dBi`
- **radiationPattern:** `E(theta,phi) = sum(I_n * exp(-jk*r_n*cos(theta)) * sin(theta))`
- **bandwidth:** `BW = (1-tau)/(1+tau) * 100% per octave`

## Mock Solver Hints

- **Impedance Model:** Use transmission line theory with alternating phase connections and mutual coupling between adjacent elements
- **Radiation Model:** Apply superposition of individual dipole patterns with progressive phase shifts and amplitude tapering
- **Key Assumptions:**
  - Only elements near resonance contribute significantly to radiation
  - Mutual coupling effects can be approximated using method of moments
  - Feeder line acts as a traveling wave transmission line
  - Ground plane effects negligible for elevated mounting

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 9
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Chapter 8
- Carrel, R., 'The Design of Log-Periodic Dipole Antennas', IRE International Convention Record, 1961
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, Chapter 10

