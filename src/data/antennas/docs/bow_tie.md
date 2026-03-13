# Bow-Tie Antenna (broadband)

**Category:** broadband

## Overview

A planar broadband antenna consisting of two triangular conducting elements arranged in a bow-tie configuration. The antenna provides excellent broadband characteristics due to its self-complementary properties and gradual impedance transition. It is widely used in UWB applications, EMC testing, and time-domain measurements where constant impedance and stable radiation patterns across wide frequency ranges are required.

- **Frequency Range:** 100000000 - 18000000000 Hz
- **Typical Gain:** 2 to 8 dBi
- **Bandwidth:** >100%
- **Polarization:** linear
- **Applications:** Ultra-wideband communications, EMC testing, Time-domain measurements, Ground penetrating radar, Impulse radar systems, Broadband direction finding, Wideband jamming systems

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Flare Angle | α | degrees | 60 | 30 - 90 |
| Antenna Length | L | m | 0.5 * c / f_low | 0.1 - 2 |
| Feed Gap | g | m | 0.01 * c / f_center | 0.001 - 0.05 |
| Substrate Thickness | h | m | 0.005 * c / f_center | 0.0001 - 0.01 |
| Relative Permittivity | εr | dimensionless | 4.4 | 1 - 12 |

## Design Methodology

Design process focuses on achieving broadband impedance matching through proper flare angle selection and dimensional scaling based on the lowest operating frequency.

### Step 1: Determine Operating Frequency Range

Define the required frequency band and calculate the wavelength at the lowest frequency

**Formula:** `λ_low = c / f_low`

### Step 2: Select Flare Angle

Choose flare angle for optimal impedance matching, typically 60° for 50Ω systems

**Formula:** `Z0 ≈ 188.5 / sqrt(εr) * sin(α/2) for small angles`

### Step 3: Calculate Antenna Length

Set total length to approximately half wavelength at lowest frequency

**Formula:** `L = 0.5 * λ_low / sqrt(εr_eff)`

### Step 4: Determine Feed Gap

Size the feed gap to maintain 50Ω impedance and minimize reflections

**Formula:** `g = 0.01 * λ_center`

### Step 5: Optimize Substrate Parameters

Select substrate thickness and permittivity for printed versions

**Formula:** `h < 0.1 * λ_high / sqrt(εr)`

### Step 6: Verify Bandwidth Performance

Check VSWR across the band and adjust dimensions if needed

**Formula:** `VSWR < 2 for |Γ| < 0.33`

## Equations

- **resonantFrequency:** `f_res = c / (2 * L * sqrt(εr_eff))`
- **inputImpedance:** `Z_in ≈ 188.5 / sqrt(εr) * sin(α/2) * (1 + j * tan(β*L/2))`
- **gain:** `G(θ,φ) ≈ 1.64 * sin²(θ) * [sin(π*L*sin(θ)*cos(φ)/λ) / (π*L*sin(θ)*cos(φ)/λ)]²`
- **radiationPattern:** `E(θ,φ) = j * η * I0 * exp(-jkr) / (4πr) * sin(θ) * sinc(π*L*sin(θ)*cos(φ)/λ)`
- **bandwidth:** `BW = 2 * (f_high - f_low) / (f_high + f_low) * 100%`

## Mock Solver Hints

- **Impedance Model:** Use method of moments with triangular basis functions on the conducting surfaces, accounting for edge effects and current distribution tapering
- **Radiation Model:** Apply Huygens principle with equivalent magnetic currents on the aperture, considering the finite flare angle and substrate effects
- **Key Assumptions:**
  - Thin substrate approximation for printed versions
  - Perfect conductor assumption for metal elements
  - Uniform current distribution approximation for initial analysis
  - Far-field radiation pattern calculation
  - Linear polarization in the E-plane

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Wiley, 2011

