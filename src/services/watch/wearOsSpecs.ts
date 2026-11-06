/**
 * Samsung Galaxy Watch 4 (SM-R860, 40mm) Hardware & Wear OS Technical Profile
 */
export const GALAXY_WATCH_4_SPECS = {
  modelNumber: 'SM-R860NZKAXAA',
  modelName: 'Samsung Galaxy Watch 4 (40mm Bluetooth)',
  screen: {
    shape: 'circular' as const,
    diameterMm: 40.4,
    displaySizeInches: 1.19,
    widthPx: 396,
    heightPx: 396,
    resolution: '396 x 396',
    densityPpi: 330,
    type: 'Circular Super AMOLED',
    colorDepth: '16M colors',
    corningGorillaGlass: 'DX+',
  },
  internals: {
    chipset: 'Exynos W920 (5 nm)',
    cpu: 'Dual-core 1.18 GHz Cortex-A55',
    gpu: 'Mali-G68',
    ram: '1.5 GB RAM',
    internalStorage: '16 GB eMMC',
    batteryCapacityMah: 247,
  },
  sensors: [
    'Samsung BioActive Sensor (Optical Heart Rate + Electrical Heart + Bioelectrical Impedance)',
    'Accelerometer (up to 32G)',
    'Barometer',
    'Gyro Sensor',
    'Geomagnetic Sensor',
    'Light Sensor',
  ],
  os: {
    platform: 'Wear OS Powered by Samsung (Wear OS 3 / 4 / 5)',
    apiLevel: 30, // Android 11 (R) baseline for GW4
    targetApiLevel: 34,
    composeWearVersion: '1.3.1',
    horologistVersion: '0.6.9',
  },
  safeInsetPadding: {
    top: 38,
    bottom: 38,
    horizontal: 28,
  },
};

/**
 * Calculates whether a point (x, y) relative to screen center (0,0) falls inside the circular 396x396 display.
 */
export function isPointInsideRoundScreen(x: number, y: number, radius = 198): boolean {
  return x * x + y * y <= radius * radius;
}

/**
 * Calculates rotary angle (in degrees 0-360) from center of display for simulated bezel turning.
 */
export function calculateBezelAngle(centerX: number, centerY: number, clientX: number, clientY: number): number {
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  let rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI + 90; // Top is 0 deg
  if (deg < 0) deg += 360;
  return deg;
}
