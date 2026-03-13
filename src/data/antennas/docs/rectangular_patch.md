# Rectangular Microstrip Patch

**Category:** microstrip

## Overview

A rectangular conducting patch printed on a grounded dielectric substrate, operating as a resonant cavity antenna. The patch radiates primarily from the fringing fields at the edges perpendicular to the current flow. It is one of the most widely used microstrip antenna configurations due to its simple geometry and predictable performance.

- **Frequency Range:** 100000000 - 100000000000 Hz
- **Typical Gain:** 3 to 9 dBi
- **Bandwidth:** 1-5%
- **Polarization:** linear
- **Applications:** Mobile communications, GPS systems, WLAN devices, Satellite communications, Radar systems, IoT sensors, Automotive radar

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Patch Length | L | m | c/(2*f*sqrt(εr_eff)) - 2*ΔL | 0.001 - 0.5 |
| Patch Width | W | m | c/(2*f)*sqrt(2/(εr+1)) | 0.001 - 0.5 |
| Substrate Thickness | h | m | 0.003*c/f | 0.0001 - 0.01 |
| Relative Permittivity | εr | dimensionless | 4.4 | 1 - 15 |
| Loss Tangent | tan(δ) | dimensionless | 0.02 | 0.0001 - 0.1 |
| Feed Position X | xf | m | 0 | -0.25 - 0.25 |
| Feed Position Y | yf | m | -L/4 | -0.25 - 0.25 |

## Design Methodology

The design process involves calculating the patch dimensions for resonance at the desired frequency, accounting for fringing field effects and substrate properties.

### Step 1: Calculate Patch Width

Determine the optimal width for maximum radiation efficiency

**Formula:** `W = c/(2*f0) * sqrt(2/(εr + 1))`

### Step 2: Calculate Effective Dielectric Constant

Account for fringing fields in the effective permittivity

**Formula:** `εr_eff = (εr + 1)/2 + (εr - 1)/2 * (1 + 12*h/W)^(-1/2)`

### Step 3: Calculate Extension Length

Determine the equivalent extension due to fringing fields

**Formula:** `ΔL = 0.412*h * (εr_eff + 0.3)*(W/h + 0.264)/((εr_eff - 0.258)*(W/h + 0.8))`

### Step 4: Calculate Patch Length

Determine the resonant length accounting for extensions

**Formula:** `L = c/(2*f0*sqrt(εr_eff)) - 2*ΔL`

### Step 5: Calculate Input Resistance

Determine the input resistance at the edge feed

**Formula:** `Rin = 1/(2*G1) where G1 = I1/(120*π^2) * integral of radiation conductance`

### Step 6: Optimize Feed Position

Adjust feed location for desired input impedance

**Formula:** `Rin(y) = Rin(0) * cos^2(π*y/L)`

## Equations

- **resonantFrequency:** `f0 = c/(2*L_eff*sqrt(εr_eff)) where L_eff = L + 2*ΔL`
- **inputImpedance:** `Zin = Rin + j*Xin where Rin = cos^2(π*yf/L)/(2*G1)`
- **gain:** `G = 4*π*U_max/P_rad ≈ 2*π*W*L*εr_eff/(λ0^2)`
- **radiationPattern:** `E(θ,φ) = j*k0*h*J*sinc(k0*W*sin(θ)*cos(φ)/2)*sinc(k0*L*sin(θ)*sin(φ)/2)`
- **bandwidth:** `BW ≈ 3.77*(εr - 1)*h*εr^2/(εr_eff*λ0) for VSWR < 2`

## Mock Solver Hints

- **Impedance Model:** transmission_line_model
- **Radiation Model:** cavity_model_with_magnetic_walls
- **Key Assumptions:**
  - Perfect electric conductor patch
  - Perfect magnetic conductor side walls
  - Thin substrate approximation h << λ0
  - Dominant TM10 mode excitation
  - Uniform current distribution approximation

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Wiley, 2011
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007
- Garg, R., 'Microstrip Antenna Design Handbook', Artech House, 2001

