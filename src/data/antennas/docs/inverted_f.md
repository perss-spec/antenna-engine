# Inverted-F Antenna (microstrip)

**Category:** microstrip

## Overview

A compact planar antenna consisting of a horizontal radiating element connected to a ground plane through a shorting pin, with a separate feed point. The inverted-F configuration provides good impedance matching and compact size, making it ideal for mobile communications. The antenna exhibits monopole-like radiation characteristics with linear polarization.

- **Frequency Range:** 800000000 - 6000000000 Hz
- **Typical Gain:** 0 to 5 dBi
- **Bandwidth:** 5-15%
- **Polarization:** linear
- **Applications:** Mobile phones, WiFi devices, Bluetooth modules, IoT sensors, Portable radios, RFID tags

## Parameters

| Parameter | Symbol | Unit | Default Formula | Range |
|-----------|--------|------|----------------|-------|
| Radiating Element Length | L | mm | 0.25 * c / f | 10 - 100 |
| Radiating Element Width | W | mm | 0.02 * c / f | 1 - 20 |
| Antenna Height | h | mm | 0.05 * c / f | 2 - 15 |
| Short Pin Position | Ls | mm | 0.05 * c / f | 1 - 20 |
| Feed Point Position | Lf | mm | 0.02 * c / f | 1 - 15 |
| Ground Plane Length | Lg | mm | 0.5 * c / f | 20 - 200 |
| Ground Plane Width | Wg | mm | 0.5 * c / f | 20 - 200 |

## Design Methodology

Design process involves determining antenna dimensions for desired frequency, optimizing feed and short positions for impedance matching, and adjusting geometry for bandwidth requirements.

### Step 1: Calculate Initial Length

Determine radiating element length for fundamental resonance

**Formula:** `L = 0.25 * c / f - Ls`

### Step 2: Set Antenna Height

Choose height based on bandwidth and size constraints

**Formula:** `h = (0.03 to 0.07) * c / f`

### Step 3: Position Shorting Pin

Place shorting pin to achieve desired resonant frequency

**Formula:** `Ls = (0.03 to 0.08) * c / f`

### Step 4: Optimize Feed Position

Adjust feed point location for 50-ohm impedance matching

**Formula:** `Lf = Ls * sqrt(50 / Zin_target)`

### Step 5: Design Ground Plane

Size ground plane for desired radiation characteristics

**Formula:** `Lg = Wg >= 0.5 * c / f`

### Step 6: Adjust Element Width

Optimize width for bandwidth enhancement

**Formula:** `W = (0.01 to 0.03) * c / f`

## Equations

- **resonantFrequency:** `f0 = c / (4 * (L + Ls))`
- **inputImpedance:** `Zin = 50 * (Lf / Ls)^2`
- **gain:** `G = 1.76 + 10*log10(1 + (h/lambda)^2)`
- **radiationPattern:** `E(theta) = cos(theta) * sin(k*L*cos(theta)/2) / (1 - cos(theta))`
- **bandwidth:** `BW = (W/lambda) * (h/lambda) * 100%`

## Mock Solver Hints

- **Impedance Model:** transmission_line_with_stub_loading
- **Radiation Model:** monopole_over_finite_ground
- **Key Assumptions:**
  - Perfect conductor assumption
  - Thin wire approximation for radiating element
  - Finite ground plane effects included
  - Substrate losses neglected in first-order analysis

## References

- Balanis, C.A., 'Antenna Theory: Analysis and Design', 4th Edition, Wiley, 2016
- Stutzman, W.L. and Thiele, G.A., 'Antenna Theory and Design', 3rd Edition, Wiley, 2012
- Pozar, D.M., 'Microwave Engineering', 4th Edition, Wiley, 2011
- Volakis, J.L., 'Antenna Engineering Handbook', 4th Edition, McGraw-Hill, 2007

