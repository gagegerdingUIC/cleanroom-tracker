/**
 * stepFinder.ts — Automatic step-height detection in profilometer scans.
 *
 * Pipeline: [optional detrend] → smooth → differentiate → find peaks → measure plateaus
 *
 * Supports three smoothing methods:
 * - Moving average (simple, fast)
 * - Savitzky-Golay (polynomial-fitting FIR filter, preserves step edges)
 * - Gaussian (weighted kernel, good noise reduction)
 */

import { polyFit, polyEval } from "./analysisEngine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SmoothingMethod = "moving-average" | "savitzky-golay" | "gaussian";

export interface StepFinderOptions {
  /** Minimum step height to report (Å). Default: 500 */
  minStepHeight?: number;
  /** Approximate width of features (µm) — controls smoothing & edge separation. Default: 100 */
  featureWidthUm?: number;
  /** Smoothing algorithm. Default: 'moving-average' */
  smoothingMethod?: SmoothingMethod;
  /** Polynomial order for Savitzky-Golay. Default: 3 */
  sgPolyOrder?: number;
  /** Polynomial order for detrending (0=none, 1=linear, 2=quadratic, 3=cubic). Default: 0 */
  detrendOrder?: number;
}

export interface DetectedStep {
  /** Midpoint X position of the step edge (µm) */
  centerUm: number;
  /** Absolute height difference |leftMean - rightMean| in Å */
  stepHeight: number;
  /** Index where the step edge begins */
  edgeStartIdx: number;
  /** Index where the step edge ends */
  edgeEndIdx: number;
  /** Mean Z of the plateau to the left of the edge (Å) */
  leftMean: number;
  /** Mean Z of the plateau to the right of the edge (Å) */
  rightMean: number;
}

export interface StepFinderResult {
  /** Detected step edges with height measurements */
  steps: DetectedStep[];
  /** Smoothed derivative dZ/dX (same length as input) */
  derivative: Float64Array;
  /** Data after smoothing (and detrending if enabled) */
  smoothedData: Float64Array;
  /** Data after polynomial detrend, before smoothing (null if no detrend) */
  detrendedData: Float64Array | null;
  /** Polynomial coefficients used for detrending (empty if none) */
  detrendCoeffs: number[];
}

// ---------------------------------------------------------------------------
// Smoothing implementations
// ---------------------------------------------------------------------------

/** Moving-average smooth. */
function smoothMovingAvg(data: Float64Array, halfWidth: number): Float64Array {
  const n = data.length;
  const out = new Float64Array(n);
  const hw = Math.max(1, halfWidth);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - hw);
    const hi = Math.min(n - 1, i + hw);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += data[j];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

/**
 * Savitzky-Golay smoothing filter.
 *
 * Fits a polynomial of given order to a sliding window of data points,
 * then evaluates it at the center. This preserves step edges better than
 * a simple moving average because the polynomial can follow sharp transitions.
 *
 * @param data Input data
 * @param halfWidth Half the window size (full window = 2*halfWidth + 1)
 * @param polyOrder Polynomial order (must be < window size). Default: 3
 */
function smoothSavitzkyGolay(
  data: Float64Array,
  halfWidth: number,
  polyOrder: number = 3,
): Float64Array {
  const n = data.length;
  const hw = Math.max(1, halfWidth);
  const windowSize = 2 * hw + 1;
  const order = Math.min(polyOrder, windowSize - 1);

  // Precompute SG convolution coefficients for the smoothing case (0th derivative)
  // using the pseudo-inverse approach: coeffs = row 0 of (J^T J)^{-1} J^T
  // where J is the Vandermonde matrix for positions -hw..+hw
  const coeffs = computeSGCoeffs(hw, order);

  const out = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    if (i >= hw && i < n - hw) {
      // Interior: full convolution
      let sum = 0;
      for (let j = -hw; j <= hw; j++) {
        sum += coeffs[j + hw] * data[i + j];
      }
      out[i] = sum;
    } else {
      // Edge: fall back to simple average
      const lo = Math.max(0, i - hw);
      const hi = Math.min(n - 1, i + hw);
      let sum = 0;
      for (let j = lo; j <= hi; j++) sum += data[j];
      out[i] = sum / (hi - lo + 1);
    }
  }

  return out;
}

/** Compute Savitzky-Golay convolution coefficients for smoothing (0th derivative). */
function computeSGCoeffs(halfWidth: number, order: number): Float64Array {
  const m = 2 * halfWidth + 1;
  const n = order + 1;

  // Build Vandermonde matrix J (m × n) for positions -hw..+hw
  const J: number[][] = [];
  for (let i = 0; i < m; i++) {
    const x = i - halfWidth;
    const row: number[] = [];
    let xPow = 1;
    for (let j = 0; j < n; j++) {
      row.push(xPow);
      xPow *= x;
    }
    J.push(row);
  }

  // Compute J^T J (n × n)
  const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let sum = 0;
      for (let i = 0; i < m; i++) sum += J[i][r] * J[i][c];
      JtJ[r][c] = sum;
    }
  }

  // Compute J^T (n × m) — we need its first row dotted with (JtJ)^{-1} row 0
  // Actually, we need row 0 of (JtJ)^{-1} J^T = smoothing coefficients

  // Invert JtJ via Gaussian elimination with augmented identity
  const aug: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = [...JtJ[r]];
    for (let c = 0; c < n; c++) row.push(r === c ? 1 : 0);
    aug.push(row);
  }

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-30) break;

    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  // Extract inverse: right half of augmented matrix
  const JtJinv: number[][] = [];
  for (let r = 0; r < n; r++) {
    JtJinv.push(aug[r].slice(n));
  }

  // Compute row 0 of (JtJ)^{-1} J^T → smoothing coefficients
  const coeffs = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += JtJinv[0][j] * J[i][j];
    }
    coeffs[i] = sum;
  }

  return coeffs;
}

/**
 * Gaussian smoothing filter.
 *
 * @param data Input data
 * @param sigma Standard deviation in index units
 */
function smoothGaussian(data: Float64Array, sigma: number): Float64Array {
  const n = data.length;
  const s = Math.max(0.5, sigma);

  // Kernel radius: 3σ covers 99.7% of the Gaussian
  const radius = Math.ceil(3 * s);
  const kernelSize = 2 * radius + 1;

  // Build normalized Gaussian kernel
  const kernel = new Float64Array(kernelSize);
  let kernelSum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    kernel[i] = Math.exp((-x * x) / (2 * s * s));
    kernelSum += kernel[i];
  }
  for (let i = 0; i < kernelSize; i++) kernel[i] /= kernelSum;

  // Convolve
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let wSum = 0;
    for (let j = -radius; j <= radius; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < n) {
        const w = kernel[j + radius];
        sum += w * data[idx];
        wSum += w;
      }
    }
    out[i] = sum / wSum;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Derivative & peak finding
// ---------------------------------------------------------------------------

/** Central-difference derivative dZ/dX (Å per index step). */
function computeDerivative(data: Float64Array): Float64Array {
  const n = data.length;
  const dz = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    dz[i] = (data[i + 1] - data[i - 1]) / 2;
  }
  dz[0] = data.length > 1 ? data[1] - data[0] : 0;
  dz[n - 1] = data.length > 1 ? data[n - 1] - data[n - 2] : 0;
  return dz;
}

/**
 * Find indices of local maxima in |data| above `threshold`,
 * with a minimum separation of `minSep` indices.
 */
function findPeaks(
  data: Float64Array,
  threshold: number,
  minSep: number,
): number[] {
  const abs = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) abs[i] = Math.abs(data[i]);

  const peaks: number[] = [];
  for (let i = 1; i < abs.length - 1; i++) {
    if (abs[i] > threshold && abs[i] >= abs[i - 1] && abs[i] >= abs[i + 1]) {
      // Enforce minimum separation — keep the taller peak
      if (peaks.length > 0 && i - peaks[peaks.length - 1] < minSep) {
        if (abs[i] > abs[peaks[peaks.length - 1]]) {
          peaks[peaks.length - 1] = i;
        }
        // else skip this peak
      } else {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

/** Mean of data[start..end] inclusive. */
function regionMean(data: Float64Array, start: number, end: number): number {
  if (start > end) return NaN;
  let sum = 0;
  for (let i = start; i <= end; i++) sum += data[i];
  return sum / (end - start + 1);
}

// ---------------------------------------------------------------------------
// Main step finder
// ---------------------------------------------------------------------------

/**
 * Detect step edges in a profilometer scan and return measured step heights,
 * plus the derivative and smoothed data for visualization.
 *
 * @param xPositions  Scan positions in µm (Float64Array, length N)
 * @param data        Height data in Å (Float64Array, length N)
 * @param options     Configuration for smoothing, detrending, and detection
 */
export function findSteps(
  xPositions: Float64Array,
  data: Float64Array,
  optionsOrMinStep?: StepFinderOptions | number,
  featureWidthUmLegacy?: number,
): StepFinderResult {
  // Support legacy signature: findSteps(x, data, minStepHeight, featureWidthUm)
  let opts: Required<StepFinderOptions>;
  if (typeof optionsOrMinStep === "number") {
    opts = {
      minStepHeight: optionsOrMinStep,
      featureWidthUm: featureWidthUmLegacy ?? 100,
      smoothingMethod: "moving-average",
      sgPolyOrder: 3,
      detrendOrder: 0,
    };
  } else {
    const o = optionsOrMinStep ?? {};
    opts = {
      minStepHeight: o.minStepHeight ?? 500,
      featureWidthUm: o.featureWidthUm ?? 100,
      smoothingMethod: o.smoothingMethod ?? "moving-average",
      sgPolyOrder: o.sgPolyOrder ?? 3,
      detrendOrder: o.detrendOrder ?? 0,
    };
  }

  const n = data.length;
  if (n < 10) {
    return {
      steps: [],
      derivative: new Float64Array(n),
      smoothedData: new Float64Array(data),
      detrendedData: null,
      detrendCoeffs: [],
    };
  }

  const xRes = xPositions[1] - xPositions[0]; // µm per point
  if (xRes <= 0) {
    return {
      steps: [],
      derivative: new Float64Array(n),
      smoothedData: new Float64Array(data),
      detrendedData: null,
      detrendCoeffs: [],
    };
  }

  // Step 1: Optional polynomial detrending
  let workingData = data;
  let detrendedData: Float64Array | null = null;
  let detrendCoeffs: number[] = [];

  if (opts.detrendOrder > 0) {
    // Fit polynomial to the full scan
    const indices: [number, number][] = [[0, n - 1]];
    detrendCoeffs = polyFit(xPositions, data, indices, opts.detrendOrder);

    detrendedData = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      detrendedData[i] = data[i] - polyEval(detrendCoeffs, xPositions[i]);
    }
    workingData = detrendedData;
  }

  // Step 2: Smooth
  const smoothHW = Math.max(1, Math.round(opts.featureWidthUm / xRes / 10));

  let smoothedData: Float64Array;
  switch (opts.smoothingMethod) {
    case "savitzky-golay":
      smoothedData = smoothSavitzkyGolay(workingData, smoothHW, opts.sgPolyOrder);
      break;
    case "gaussian": {
      // Sigma ≈ halfWidth / 2 gives similar effective width to moving average
      const sigma = Math.max(1, smoothHW / 2);
      smoothedData = smoothGaussian(workingData, sigma);
      break;
    }
    case "moving-average":
    default:
      smoothedData = smoothMovingAvg(workingData, smoothHW);
      break;
  }

  // Step 3: Differentiate
  const dz = computeDerivative(smoothedData);

  // Step 4: Find peaks in |dZ/dX|
  // Threshold: a step of minStepHeight spread over ~2*smoothHW points
  const threshold = opts.minStepHeight / (2 * smoothHW);
  const minSep = Math.max(3, Math.round(opts.featureWidthUm / xRes / 4));
  const peaks = findPeaks(dz, threshold, minSep);

  if (peaks.length === 0) {
    return {
      steps: [],
      derivative: dz,
      smoothedData,
      detrendedData,
      detrendCoeffs,
    };
  }

  // Step 5: Measure plateau heights around each peak
  const steps: DetectedStep[] = [];
  const plateauHW = Math.max(3, smoothHW);

  for (let i = 0; i < peaks.length; i++) {
    const edgeIdx = peaks[i];

    // Left plateau: region before this edge
    const leftEnd = Math.max(0, edgeIdx - Math.round(smoothHW / 2));
    const leftStart = Math.max(0, leftEnd - plateauHW);

    // Right plateau: region after this edge
    const rightStart = Math.min(n - 1, edgeIdx + Math.round(smoothHW / 2));
    const rightEnd = Math.min(n - 1, rightStart + plateauHW);

    if (leftStart >= leftEnd || rightStart >= rightEnd) continue;

    // Measure on the working data (detrended if applicable), not the smoothed
    const leftMean = regionMean(workingData, leftStart, leftEnd);
    const rightMean = regionMean(workingData, rightStart, rightEnd);
    const height = Math.abs(leftMean - rightMean);

    if (height < opts.minStepHeight) continue;

    steps.push({
      centerUm: xPositions[edgeIdx],
      stepHeight: height,
      edgeStartIdx: leftEnd,
      edgeEndIdx: rightStart,
      leftMean,
      rightMean,
    });
  }

  return {
    steps,
    derivative: dz,
    smoothedData,
    detrendedData,
    detrendCoeffs,
  };
}

// ---------------------------------------------------------------------------
// Export smoothing functions for direct use
// ---------------------------------------------------------------------------

export { smoothMovingAvg, smoothSavitzkyGolay, smoothGaussian, computeDerivative };
