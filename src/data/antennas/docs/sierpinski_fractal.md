# Sierpinski Fractal

**Category:** special

## Overview

A fractal antenna based on the Sierpinski triangle geometry, exhibiting self-similar multiband characteristics with logarithmically periodic frequency response. The fractal structure provides multiple resonances at frequencies related by the scaling factor, typically offering 3-5 distinct operating bands with similar radiation patterns.

- **Frequency Range:** 300000000 - 6000000000 Hz
- **Typical Gain:** 2 to 6 dBi
- **Bandwidth:** 15-25% per band
- **Polarization:** linear
- **Applications:** Multiband wireless communications, Software defined radio, Cognitive radio systems, Compact multiband base stations, RFID readers, Ultra-wideband applications

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Iteration Level | n | dimensionless | 3 | 1 - 5 |
| Scaling Factor | δ | dimensionless | 0.5 | 0.3 - 0.7 |
| Base Triangle Side Length | L0 | m | 0.25 * λ0 | 0.1 - 0.5 |
| Wire Radius | a | m | 0.001 * λ0 | 0.0001 - 0.01 |
| Feed Gap | g | m | 0.01 * λ0 | 0.001 - 0.05 |

## Design Methodology

Design process involves determining the fractal geometry parameters, calculating resonant frequencies for each iteration level, optimizing the scaling factor for desired frequency ratios, and adjusting feed structure for impedance matching across multiple bands.

### Step 1: Determine Base Frequency and Triangle Size

Calculate the base triangle dimensions for the lowest operating frequency

**Formula:** `L0 = 0.25 * c / f0`

### Step 2: Select Iteration Level

Choose fractal iteration level based on desired number of operating bands

**Formula:** `Number_of_bands ≈ n + 1`

### Step 3: Calculate Scaling Factor

Determine scaling factor for desired frequency spacing between bands

**Formula:** `δ = f_n / f_(n+1)`

### Step 4: Generate Fractal Geometry

Create successive iterations using the scaling factor

**Formula:** `L_n = L0 * δ^n`

### Step 5: Calculate Resonant Frequencies

Determine resonant frequencies for each iteration level

**Formula:** `f_n = c / (4 * L_n)`

### Step 6: Design Feed Structure

Optimize feed gap and matching network for multiband operation

**Formula:** `g = 0.01 * c / f0`

### Step 7: Impedance Matching

Adjust wire radius and feed structure for acceptable VSWR across bands

**Formula:** `Z_in ≈ 120 * ln(L/a)`

## Equations

- **resonantFrequency:** `f_n = c / (4 * L0 * δ^n)`
- **inputImpedance:** `Z_in ≈ 120 * ln(L_eff / a) - j * X_gap`
- **gain:** `G ≈ 1.64 + 10 * log10(L_eff / λ)`
- **radiationPattern:** `E(θ,φ) = Σ I_n * sin(k * L_n * cos(θ)) / (k * L_n * cos(θ))`
- **bandwidth:** `BW_n ≈ 2 * a / L_n * 100%`

## Mock Solver Hints

- **Impedance Model:** Use method of moments with triangular basis functions for wire segments, include mutual coupling between fractal elements
- **Radiation Model:** Superposition of radiation from all wire segments with appropriate phase relationships, account for fractal self-similarity
- **Key Assumptions:**
  - Thin wire approximation valid for a << λ
  - Perfect conductor assumption
  - Fractal elements are electrically small at lowest frequency
  - Self-similarity provides logarithmic periodicity
  - Feed point located at base of largest triangle

## References

- Balanis, C.A. 'Antenna Theory: Analysis and Design', 4th Edition, Chapter 14
- Volakis, J.L. 'Antenna Engineering Handbook', 4th Edition, Chapter 20
- Werner, D.H. 'Fractal Antenna Engineering Handbook', Artech House
- Puente, C. 'Fractal Antennas: A Novel Antenna Miniaturization Technique', IEEE Antennas and Propagation Magazine

