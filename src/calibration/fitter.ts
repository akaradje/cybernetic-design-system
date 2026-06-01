import type { MetricVector, CalibratedWeights } from './types';

/**
 * M6 — Ridge regression fitter.
 *
 * Re-fit metric weights via ridge regression on human ratings.
 * This is exactly how Reinecke and successors built predictive models:
 *   human_score ≈ Σ w_m * feature_m + ε
 *
 * Ridge regression adds L2 regularization to prevent overfitting:
 *   minimize ||Xw - y||² + λ||w||²
 *
 * The closed-form solution: w = (X'X + λI)⁻¹ X'y
 */

/**
 * Fit weights via ridge regression.
 *
 * @param vectors - metric vectors with human scores
 * @param lambda - regularization strength (default 0.1)
 * @returns calibrated weights with fit statistics
 */
export function fitRidge(
  vectors: MetricVector[],
  lambda: number = 0.1,
): CalibratedWeights {
  if (vectors.length === 0) {
    return emptyWeights('ridge');
  }

  // Extract feature names (consistent ordering).
  let featureNames = Object.keys(vectors[0].features);
  const n = vectors.length;
  let p = featureNames.length;

  // Feature selection: if too few samples, use only the most important features.
  // Priority order matches evidence grading in §1.6.
  const FEATURE_PRIORITY = [
    'symmetry', 'cohesion', 'balance', 'equilibrium', 'sequence', 'unity',
    'contrast', 'grid', 'birkhoff', 'hick',
    'proportion', 'simplicity', 'density', 'regularity',
    'economy', 'homogeneity', 'rhythm',
  ];

  if (n < p + 1) {
    // Select top features that fit the sample count.
    const maxFeatures = Math.max(2, n - 1);
    const selected = FEATURE_PRIORITY.filter((f) => featureNames.includes(f)).slice(0, maxFeatures);
    if (selected.length < 2) {
      return emptyWeights('ridge');
    }
    featureNames = selected;
    p = featureNames.length;
  }

  // Build matrix X (n × p) and vector y (n × 1).
  const X: number[][] = vectors.map((v) =>
    featureNames.map((f) => v.features[f] ?? 0),
  );
  const y: number[] = vectors.map((v) => v.humanScore);

  // Compute X'X (p × p).
  const XtX = matMul(transpose(X), X);

  // Add regularization: X'X + λI
  for (let i = 0; i < p; i++) {
    XtX[i][i] += lambda;
  }

  // Compute X'y (p × 1).
  const Xty = matVecMul(transpose(X), y);

  // Solve (X'X + λI)w = X'y via Gaussian elimination.
  const w = solveLinear(XtX, Xty);

  // Compute R² and MAE.
  const predictions = X.map((row) => dot(row, w));
  const r2 = computeR2(y, predictions);
  const mae = computeMAE(y, predictions);

  // Build weight map.
  const weights: Record<string, number> = {};
  for (let i = 0; i < featureNames.length; i++) {
    weights[featureNames[i]] = Math.round(w[i] * 1000) / 1000;
  }

  return {
    weights,
    r2: Math.round(r2 * 1000) / 1000,
    mae: Math.round(mae * 1000) / 1000,
    sampleCount: n,
    method: 'ridge',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fit weights via ordinary least squares (no regularization).
 * Useful as a baseline comparison.
 */
export function fitOLS(vectors: MetricVector[]): CalibratedWeights {
  return fitRidge(vectors, 0);
}

// ── Linear algebra utilities ──

function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  const AT: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      AT[j][i] = A[i][j];
    }
  }
  return AT;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0]?.length ?? 0;
  const colsB = B[0]?.length ?? 0;
  const C: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function matVecMul(A: number[][], b: number[]): number[] {
  return A.map((row) => dot(row, b));
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Solve Ax = b via Gaussian elimination with partial pivoting.
 */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augmented matrix [A|b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }

    // Swap rows
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

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

/**
 * Compute R² (coefficient of determination).
 */
function computeR2(y: number[], predictions: number[]): number {
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const ssRes = y.reduce((s, yi, i) => s + Math.pow(yi - predictions[i], 2), 0);
  const ssTot = y.reduce((s, yi) => s + Math.pow(yi - mean, 2), 0);
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

/**
 * Compute mean absolute error.
 */
function computeMAE(y: number[], predictions: number[]): number {
  return y.reduce((s, yi, i) => s + Math.abs(yi - predictions[i]), 0) / y.length;
}

function emptyWeights(method: 'ridge' | 'ols'): CalibratedWeights {
  return {
    weights: {},
    r2: 0,
    mae: 0,
    sampleCount: 0,
    method,
    timestamp: new Date().toISOString(),
  };
}
