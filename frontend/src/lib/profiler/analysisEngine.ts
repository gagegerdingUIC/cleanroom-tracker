/**
 * Pure math functions for stylus profiler step-height analysis.
 *
 * No DOM dependencies — all functions take typed arrays and return results.
 */

export interface AnalysisWindow {
  /** Start index (inclusive) */
  start: number;
  /** End index (inclusive) */
  end: number;
}

export interface WindowStats {
  mean: number;
  ra: number; // arithmetic average roughness
  rq: number; // RMS roughness
}

export interface StepHeightResult {
  stepHeight: number;
  left: WindowStats;
  right: WindowStats;
  /** Leveled data (full scan), or original if levelOrder=0 */
  leveledData: Float64Array;
  /** Polynomial coefficients used for leveling (empty if none) */
  levelCoeffs: number[];
}

// ---------------------------------------------------------------------------
// Polynomial fitting via least-squares (Gaussian elimination)
// ---------------------------------------------------------------------------

/**
 * Fit a polynomial of given order to selected data points.
 *
 * @param x      x-values (full array)
 * @param y      y-values (full array, same length as x)
 * @param indices index pairs [[start,end], ...] defining which points to use
 * @param order  polynomial order (1 = linear, 2 = quadratic)
 * @returns coefficients [c0, c1, c2, ...] where y = c0 + c1*x + c2*x^2 + ...
 */
export function polyFit(
  x: Float64Array,
  y: Float64Array,
  indices: [number, number][],
  order: number
): number[] {
  const n = order + 1;

  // Build normal equations: (X^T X) c = X^T y
  // where X is the Vandermonde matrix for selected points.
  const XtX = Array.from({ length: n }, () => new Float64Array(n));
  const XtY = new Float64Array(n);

  for (const [iStart, iEnd] of indices) {
    for (let i = iStart; i <= iEnd; i++) {
      const xi = x[i];
      const yi = y[i];

      // Powers of xi
      const powers = new Float64Array(2 * order + 1);
      powers[0] = 1;
      for (let p = 1; p <= 2 * order; p++) {
        powers[p] = powers[p - 1] * xi;
      }

      for (let r = 0; r < n; r++) {
        XtY[r] += powers[r] * yi;
        for (let c = 0; c < n; c++) {
          XtX[r][c] += powers[r + c];
        }
      }
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  // Build augmented matrix
  const M: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push(XtX[r][c]);
    row.push(XtY[r]);
    M.push(row);
  }

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-30) {
      // Singular — return zeros
      return new Array(n).fill(0);
    }
    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back-substitution
  const coeffs = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * coeffs[j];
    }
    coeffs[i] = sum / M[i][i];
  }

  return coeffs;
}

/**
 * Evaluate polynomial at a single x value.
 * coeffs = [c0, c1, c2, ...] → c0 + c1*x + c2*x^2 + ...
 */
export function polyEval(coeffs: number[], x: number): number {
  let result = 0;
  let xPow = 1;
  for (const c of coeffs) {
    result += c * xPow;
    xPow *= x;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Window statistics
// ---------------------------------------------------------------------------

function computeWindowStats(
  data: Float64Array,
  start: number,
  end: number
): WindowStats {
  const count = end - start + 1;
  if (count <= 0) return { mean: 0, ra: 0, rq: 0 };

  // Mean
  let sum = 0;
  for (let i = start; i <= end; i++) sum += data[i];
  const mean = sum / count;

  // Ra (arithmetic average roughness) and Rq (RMS roughness)
  let sumAbsDev = 0;
  let sumSqDev = 0;
  for (let i = start; i <= end; i++) {
    const dev = data[i] - mean;
    sumAbsDev += Math.abs(dev);
    sumSqDev += dev * dev;
  }

  return {
    mean,
    ra: sumAbsDev / count,
    rq: Math.sqrt(sumSqDev / count),
  };
}

// ---------------------------------------------------------------------------
// Step-height computation
// ---------------------------------------------------------------------------

/**
 * Compute step height from a 1D profile with two measurement windows.
 *
 * Leveling and measurement can use separate window pairs. When levelWindows
 * is provided, the polynomial is fit to those windows; the step height is
 * then measured using left/right on the leveled data.
 *
 * @param xPositions   x positions in µm (for polynomial fitting)
 * @param data         raw height data (e.g. "Normal" column, in Å)
 * @param left         left measurement window index range
 * @param right        right measurement window index range
 * @param levelOrder   0 = no leveling, 1 = linear, 2 = quadratic
 * @param levelWindows optional separate windows for leveling fit
 */
export function computeStepHeight(
  xPositions: Float64Array,
  data: Float64Array,
  left: AnalysisWindow,
  right: AnalysisWindow,
  levelOrder: number,
  levelWindows?: { left: AnalysisWindow; right: AnalysisWindow }
): StepHeightResult {
  let leveledData: Float64Array;
  let levelCoeffs: number[] = [];

  if (levelOrder > 0) {
    // Use dedicated leveling windows if provided, otherwise fall back to measurement windows
    const lw = levelWindows ?? { left, right };
    levelCoeffs = polyFit(
      xPositions,
      data,
      [
        [lw.left.start, lw.left.end],
        [lw.right.start, lw.right.end],
      ],
      levelOrder
    );

    // Subtract polynomial from entire scan
    leveledData = new Float64Array(data.length);
    for (let i = 0; i < data.length; i++) {
      leveledData[i] = data[i] - polyEval(levelCoeffs, xPositions[i]);
    }
  } else {
    leveledData = data;
  }

  const leftStats = computeWindowStats(leveledData, left.start, left.end);
  const rightStats = computeWindowStats(leveledData, right.start, right.end);
  const stepHeight = Math.abs(leftStats.mean - rightStats.mean);

  return {
    stepHeight,
    left: leftStats,
    right: rightStats,
    leveledData,
    levelCoeffs,
  };
}

// ---------------------------------------------------------------------------
// Automatic window placement
// ---------------------------------------------------------------------------

/**
 * Find initial window positions by detecting the step edge.
 *
 * Strategy: compute a smoothed derivative, find the region of maximum
 * absolute slope (the step), then place windows on either side.
 *
 * @param data  height data array
 * @returns left and right AnalysisWindow, or defaults if detection fails
 */
/**
 * Auto-level by fitting a polynomial to flat (non-step) regions of the scan.
 *
 * Strategy:
 * 1. Smooth the data and compute the derivative
 * 2. Identify step-edge regions where |dZ/dX| exceeds a threshold
 * 3. Build index ranges from the remaining flat regions
 * 4. Fit a polynomial of the requested order to those flat regions
 * 5. Subtract the polynomial from the full scan
 *
 * @param xPositions  X positions in µm
 * @param data        Height data in Å
 * @param order       Polynomial order (1=linear, 2=quadratic, 3=cubic)
 * @returns leveled data, polynomial coefficients, and the flat-region mask used
 */
export function autoLevel(
  xPositions: Float64Array,
  data: Float64Array,
  order: number,
): { leveledData: Float64Array; coeffs: number[]; flatMask: boolean[] } {
  const n = data.length;
  if (n < 10 || order < 1) {
    return { leveledData: new Float64Array(data), coeffs: [], flatMask: new Array(n).fill(true) };
  }

  // Step 1: Smooth (moving average, ~1% of scan width)
  const smoothHW = Math.max(2, Math.floor(n * 0.005));
  const smoothed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - smoothHW);
    const hi = Math.min(n - 1, i + smoothHW);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += data[j];
    smoothed[i] = sum / (hi - lo + 1);
  }

  // Step 2: Compute |derivative| of smoothed data
  const absDeriv = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    absDeriv[i] = Math.abs(smoothed[i + 1] - smoothed[i - 1]) / 2;
  }
  absDeriv[0] = absDeriv[1] ?? 0;
  absDeriv[n - 1] = absDeriv[n - 2] ?? 0;

  // Step 3: Determine threshold — use median + 3× MAD (robust outlier detection)
  // This distinguishes gradual tilt (low derivative) from step edges (high derivative)
  const sorted = Float64Array.from(absDeriv).sort();
  const median = sorted[Math.floor(n / 2)];
  let madSum = 0;
  for (let i = 0; i < n; i++) madSum += Math.abs(absDeriv[i] - median);
  const mad = madSum / n;
  const threshold = median + 3 * mad;

  // Step 4: Build flat mask — true where |derivative| is below threshold
  // Also dilate the mask by smoothHW to exclude transition shoulders
  const rawMask = new Array<boolean>(n);
  for (let i = 0; i < n; i++) rawMask[i] = absDeriv[i] <= threshold;

  // Dilate: if any point within ±dilateRadius is masked out, mask this one too
  const dilateRadius = smoothHW * 2;
  const flatMask = new Array<boolean>(n);
  for (let i = 0; i < n; i++) {
    if (!rawMask[i]) {
      flatMask[i] = false;
      continue;
    }
    let flat = true;
    for (let j = Math.max(0, i - dilateRadius); j <= Math.min(n - 1, i + dilateRadius); j++) {
      if (!rawMask[j]) { flat = false; break; }
    }
    flatMask[i] = flat;
  }

  // Step 5: Collect flat index ranges for polyFit
  const indices: [number, number][] = [];
  let rangeStart = -1;
  for (let i = 0; i < n; i++) {
    if (flatMask[i]) {
      if (rangeStart < 0) rangeStart = i;
    } else {
      if (rangeStart >= 0) {
        indices.push([rangeStart, i - 1]);
        rangeStart = -1;
      }
    }
  }
  if (rangeStart >= 0) indices.push([rangeStart, n - 1]);

  // Need enough points for the polynomial fit
  let totalFlatPoints = 0;
  for (const [s, e] of indices) totalFlatPoints += e - s + 1;
  if (totalFlatPoints < order + 1) {
    // Not enough flat points — fall back to fitting everything
    indices.length = 0;
    indices.push([0, n - 1]);
  }

  // Step 6: Fit and subtract
  const coeffs = polyFit(xPositions, data, indices, order);
  const leveledData = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    leveledData[i] = data[i] - polyEval(coeffs, xPositions[i]);
  }

  return { leveledData, coeffs, flatMask };
}

export function findInitialWindows(
  data: Float64Array
): { left: AnalysisWindow; right: AnalysisWindow } {
  const n = data.length;
  if (n < 20) {
    return {
      left: { start: 0, end: Math.floor(n / 2) - 1 },
      right: { start: Math.floor(n / 2), end: n - 1 },
    };
  }

  // Compute smoothed absolute derivative (using a window of ~1% of data length)
  const smoothWindow = Math.max(3, Math.floor(n * 0.01));
  const halfW = Math.floor(smoothWindow / 2);
  const deriv = new Float64Array(n);

  for (let i = halfW; i < n - halfW; i++) {
    let sum = 0;
    for (let j = -halfW; j <= halfW; j++) {
      if (i + j > 0 && i + j < n) {
        sum += Math.abs(data[i + j] - data[i + j - 1]);
      }
    }
    deriv[i] = sum / (2 * halfW + 1);
  }

  // Find peak derivative location (step edge)
  let maxDeriv = 0;
  let stepCenter = Math.floor(n / 2);
  for (let i = halfW; i < n - halfW; i++) {
    if (deriv[i] > maxDeriv) {
      maxDeriv = deriv[i];
      stepCenter = i;
    }
  }

  // Define a "step region" around the peak (±5% of data length)
  const margin = Math.floor(n * 0.05);
  const stepLeft = Math.max(0, stepCenter - margin);
  const stepRight = Math.min(n - 1, stepCenter + margin);

  // Place windows: 10% to stepLeft for left, stepRight to 90% for right
  const scanStart = Math.floor(n * 0.10);
  const scanEnd = Math.floor(n * 0.90);

  return {
    left: {
      start: Math.min(scanStart, stepLeft - 1),
      end: Math.max(scanStart, stepLeft - 1),
    },
    right: {
      start: Math.min(stepRight + 1, scanEnd),
      end: Math.max(stepRight + 1, scanEnd),
    },
  };
}
