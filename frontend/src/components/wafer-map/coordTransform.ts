/**
 * Similarity transform for converting profiler coordinates → wafer coordinates.
 *
 * Transform model:
 *   wafer_x = a * prof_x - b * prof_y + tx
 *   wafer_y = b * prof_x + a * prof_y + ty
 *
 * where a = s·cos(θ), b = s·sin(θ), s = scale, θ = rotation angle.
 * Solved via least-squares from ≥2 alignment mark pairs.
 */

export interface AlignmentPair {
  wafer: { x: number; y: number };
  profiler: { x: number; y: number };
}

export interface SimilarityTransform {
  a: number;
  b: number;
  tx: number;
  ty: number;
}

/**
 * Returns true if a pair has all four coordinates filled in (non-NaN).
 */
export function isPairComplete(pair: AlignmentPair): boolean {
  return (
    isFinite(pair.wafer.x) &&
    isFinite(pair.wafer.y) &&
    isFinite(pair.profiler.x) &&
    isFinite(pair.profiler.y)
  );
}

/**
 * Compute least-squares similarity transform from profiler → wafer space.
 * Needs ≥2 complete pairs. Returns null if underdetermined.
 */
export function computeTransform(
  pairs: AlignmentPair[]
): SimilarityTransform | null {
  const complete = pairs.filter(isPairComplete);
  if (complete.length < 2) return null;

  const n = complete.length;

  // Build normal equations: A^T A x = A^T b
  // For each pair i, two rows in A:
  //   [px_i  -py_i  1  0]   →  wx_i
  //   [py_i   px_i  0  1]   →  wy_i
  //
  // x = [a, b, tx, ty]

  // A^T A is 4x4, A^T b is 4x1
  // Compute them directly to avoid allocating the full matrix.

  let sumPx2Py2 = 0; // sum(px^2 + py^2)
  let sumPx = 0;
  let sumPy = 0;

  let rhs_a = 0; // sum(px*wx + py*wy)
  let rhs_b = 0; // sum(-py*wx + px*wy)
  let rhs_tx = 0; // sum(wx)
  let rhs_ty = 0; // sum(wy)

  for (const p of complete) {
    const px = p.profiler.x;
    const py = p.profiler.y;
    const wx = p.wafer.x;
    const wy = p.wafer.y;

    sumPx2Py2 += px * px + py * py;
    sumPx += px;
    sumPy += py;

    rhs_a += px * wx + py * wy;
    rhs_b += -py * wx + px * wy;
    rhs_tx += wx;
    rhs_ty += wy;
  }

  // A^T A =
  // [sumPx2Py2    0        sumPx   sumPy ]
  // [   0      sumPx2Py2  -sumPy   sumPx ]
  // [ sumPx     -sumPy       n       0   ]
  // [ sumPy      sumPx       0       n   ]
  //
  // Solve with block structure. Let S = sumPx2Py2, u = sumPx, v = sumPy.
  // The system decouples into two 2x2 systems when we use the structure:
  //
  // [S   u] [a ]   [rhs_a  ]     [S  -v] [b ]   [rhs_b ]
  // [u   n] [tx] = [rhs_tx ]     [-v  n] [ty] = [rhs_ty]
  //
  // Wait, that's not quite right because of the cross terms. Let me solve the 4x4 directly.

  // Actually the A^T A matrix has a nice structure. Let me just invert it via Cramer's rule
  // or use the 2x2 block trick.
  //
  // Grouping equations for (a, tx) and (b, ty):
  // From the structure, we get:
  //   S*a + 0*b + u*tx + v*ty = rhs_a
  //   0*a + S*b - v*tx + u*ty = rhs_b
  //   u*a - v*b + n*tx + 0*ty = rhs_tx
  //   v*a + u*b + 0*tx + n*ty = rhs_ty
  //
  // This can be solved as two coupled 2x2 systems by substitution.
  // Let me use a direct 4x4 solve instead for clarity.

  const S = sumPx2Py2;
  const u = sumPx;
  const v = sumPy;

  // 4x4 augmented matrix, row-reduce
  // Row 0: [S,  0,  u,  v | rhs_a ]
  // Row 1: [0,  S, -v,  u | rhs_b ]
  // Row 2: [u, -v,  n,  0 | rhs_tx]
  // Row 3: [v,  u,  0,  n | rhs_ty]

  const M = [
    [S, 0, u, v, rhs_a],
    [0, S, -v, u, rhs_b],
    [u, -v, n, 0, rhs_tx],
    [v, u, 0, n, rhs_ty],
  ];

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 4; col++) {
    // Find pivot
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < 4; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j < 5; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back-substitution
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let sum = M[i][4];
    for (let j = i + 1; j < 4; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return { a: x[0], b: x[1], tx: x[2], ty: x[3] };
}

/**
 * Apply the similarity transform: profiler coords → wafer coords.
 */
export function applyTransform(
  t: SimilarityTransform,
  profiler: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: t.a * profiler.x - t.b * profiler.y + t.tx,
    y: t.b * profiler.x + t.a * profiler.y + t.ty,
  };
}

/**
 * RMS residual error (in µm) across all complete pairs.
 */
export function computeResidualError(
  t: SimilarityTransform,
  pairs: AlignmentPair[]
): number {
  const complete = pairs.filter(isPairComplete);
  if (complete.length === 0) return 0;

  let sumSq = 0;
  for (const p of complete) {
    const mapped = applyTransform(t, p.profiler);
    const dx = mapped.x - p.wafer.x;
    const dy = mapped.y - p.wafer.y;
    sumSq += dx * dx + dy * dy;
  }
  return Math.sqrt(sumSq / complete.length);
}
