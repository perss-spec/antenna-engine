# Inset-Fed Patch (microstrip)

**Category:** microstrip

## Overview

A rectangular microstrip patch antenna fed by a microstrip line inserted into the patch at a specific distance from the edge to achieve impedance matching. The inset feed eliminates the need for external matching networks by positioning the feed point at the desired input impedance location along the patch.

- **Frequency Range:** 300000000 - 100000000000 Hz
- **Typical Gain:** 6 to 9 dBi
- **Bandwidth:** 2-5%
- **Polarization:** linear
- **Applications:** GPS antennas, WiFi systems, cellular base stations, satellite communications, RFID readers, wireless sensor networks

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Patch Length | L | m | c/(2*f0*sqrt(epsilon_eff)) | 0.01 - 0.2 |
| Patch Width | W | m | c/(2*f0)*sqrt(2/(epsilon_r+1)) | 0.01 - 0.3 |
| Substrate Height | h | m | 0.01*c/f0 | 0.0001 - 0.01 |
| Relative Permittivity | epsilon_r | dimensionless | 4.4 | 2.2 - 12 |
| Inset Distance | y0 | m | L/pi*acos(sqrt(Z0/R_edge)) | 0.001 - 0.05 |
| Feedline Width | Wf | m | 8*h*exp(A)/(exp(2*A)-2) where A=Z0*sqrt((epsilon_r+1)/2)/377+((epsilon_r-1)/(epsilon_r+1))*(0.23+0.11/epsilon_r) | 0.0001 - 0.01 |

## Design Methodology

Design process involves calculating patch dimensions for resonance, determining effective permittivity, computing inset distance for impedance matching, and optimizing feedline geometry.

### Step 1: Calculate Patch Width

Determine optimal patch width for efficient radiation

**Formula:** `W = c/(2*f0)*sqrt(2/(epsilon_r+1))`

### Step 2: Calculate Effective Permittivity

Compute effective dielectric constant accounting for fringing fields

**Formula:** `epsilon_eff = (epsilon_r+1)/2 + (epsilon_r-1)/2 * (1+12*h/W)^(-0.5)`

### Step 3: Calculate Extension Length

Determine fringing field extension due to open-end effects

**Formula:** `delta_L = 0.412*h*(epsilon_eff+0.3)*(W/h+0.264)/((epsilon_eff-0.258)*(W/h+0.8))`

### Step 4: Calculate Patch Length

Determine resonant patch length including fringing effects

**Formula:** `L = c/(2*f0*sqrt(epsilon_eff)) - 2*delta_L`

### Step 5: Calculate Edge Resistance

Determine input resistance at the radiating edge

**Formula:** `R_edge = 90*(epsilon_r/epsilon_eff)^2/(W/lambda_0)`

### Step 6: Calculate Inset Distance

Determine inset distance for 50-ohm input impedance

**Formula:** `y0 = L/pi * acos(sqrt(50/R_edge))`

### Step 7: Design Feedline

Calculate microstrip feedline width for 50-ohm impedance

**Formula:** `Wf = 8*h*exp(A)/(exp(2*A)-2) where A depends on Z0 and epsilon_r`

### Step 8: Optimize Performance

Fine-tune dimensions using simulation for desired bandwidth and matching

**Formula:** `Adjust L, W, y0 based on S11 < -10 dB requirement`

## Equations

- **resonantFrequency:** `f0 = c/(2*L_eff*sqrt(epsilon_eff)) where L_eff = L + 2*delta_L`
- **inputImpedance:** `Zin = R_edge * cos^2(pi*y0/L) where R_edge = 90*(epsilon_r/epsilon_eff)^2/(W/lambda_0)`
- **gain:** `G = 4*pi*A_eff/lambda_0^2 where A_eff ≈ 0.8*W*L for rectangular patch`
- **radiationPattern:** `E_theta = j*k0*h*E0*sin(k0*W*sin(theta)*cos(phi)/2)/(k0*W*sin(theta)*cos(phi)/2) * sin(k0*L*sin(theta)*sin(phi)/2)/(k0*L*sin(theta)*sin(phi)/2)`
- **bandwidth:** `BW ≈ 3.77*(h/lambda_0)*(epsilon_r-1)/epsilon_r^2 * (W/L)`

## Mock Solver Hints

- **Impedance Model:** transmission_line_model_with_cavity_resonator
- **Radiation Model:** aperture_field_integration_with_magnetic_current_sources
- **Key Assumptions:**
  - thin substrate approximation h << lambda_0
  - perfect conductor assumption
  - TM10 dominant mode
  - negligible surface waves
  - far-field radiation pattern

## References

- Balanis C.A. 'Antenna Theory: Analysis and Design' 4th Edition Chapter 14
- Pozar D.M. 'Microwave Engineering' 4th Edition Chapter 12
- Stutzman W.L. & Thiele G.A. 'Antenna Theory and Design' 3rd Edition Chapter 10
- Volakis J.L. 'Antenna Engineering Handbook' 4th Edition Chapter 11

