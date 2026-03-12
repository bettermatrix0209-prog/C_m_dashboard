/**
 * Inverse Normal Cumulative Distribution Function
 * Approximation of the inverse normal distribution (probit function)
 */
export function pnorm(p: number): number {
  // Simple approximation for z-score
  // For higher precision, a more complex algorithm like Acklam's or Wichura's could be used
  // This is a common approximation for UI simulators
  const a1 = -3.969683028665376e+01;
  const a2 = 2.209460984245205e+02;
  const a3 = -2.759285104469687e+02;
  const a4 = 1.383577518672690e+02;
  const a5 = -3.066479806614716e+01;
  const a6 = 2.506628277459239e+00;

  const b1 = -5.447609879822406e+01;
  const b2 = 1.615858368580409e+02;
  const b3 = -1.556989798598866e+02;
  const b4 = 6.680131188771972e+01;
  const b5 = -1.328068155288572e+01;

  const c1 = -7.784894002430293e-03;
  const c2 = -3.223964580411365e-01;
  const c3 = -2.400758277161838e+00;
  const c4 = -2.549732539343734e+00;
  const c5 = 4.374664141464968e+00;
  const c6 = 2.938163982698783e+00;

  const d1 = 7.784695709041462e-03;
  const d2 = 3.224671290700398e-01;
  const d3 = 2.445134137142996e+00;
  const d4 = 3.754408661907416e+00;

  const p_low = 0.02425;
  const p_high = 1 - p_low;

  let q, r, z;

  if (p < p_low) {
    q = Math.sqrt(-2 * Math.log(p));
    z = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= p_high) {
    q = p - 0.5;
    r = q * q;
    z = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
         ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }

  return z;
}

export interface InventoryPolicy {
  mu_DL: number;
  SS: number;
  ROP: number;
}

export function calculateInventoryLogic(
  mu_D: number,
  sigma_D: number,
  mu_L: number,
  sigma_L: number,
  z: number
): InventoryPolicy {
  // μ_DL: Average demand during lead time
  const mu_DL = mu_D * mu_L;
  
  // σ_DL: Demand variability during lead time
  // var_DL = (L * σ_D^2) + (D^2 * σ_L^2)
  const var_DL = (mu_L * Math.pow(sigma_D, 2)) + (Math.pow(mu_D, 2) * Math.pow(sigma_L, 2));
  const sigma_DL = Math.sqrt(var_DL);
  
  // SS: Safety Stock
  const ss = z * sigma_DL;
  
  // ROP: Reorder Point
  const rop = mu_DL + ss;
  
  return { mu_DL, SS: ss, ROP: rop };
}

export const BASE_FORECASTS = {
  "870830 (Brakes)": { mu_D: 1650.0, sigma_D: 160.0 },
  "870840 (Gear boxes)": { mu_D: 2450.0, sigma_D: 480.0 },
};
