const camClayReference = { pressure: 1, volume: 2.8 };
const camClayShearModulus = 5000; // kPa
const camClayCriticalTolerance = 0.001; // Relative difference between q/p′ and M.

function camClayVolume(p, pc, lambda, kappa) {
  const { pressure, volume } = camClayReference;
  return volume - lambda * Math.log(pc / pressure) + kappa * Math.log(pc / p);
}

function camClayTest({ test, p0, ocr, m, lambda, kappa }) {
  const pc0 = ocr * p0;
  const isIsotropic = test === 'isotropic';
  const isUndrained = test === 'undrained';
  const initialVolume = camClayVolume(p0, pc0, lambda, kappa);
  const makeState = (p, q, pc, phase) => ({
    p, q, pc, phase,
    v: isUndrained ? initialVolume : camClayVolume(p, pc, lambda, kappa),
    u: isUndrained ? p0 + q / 3 - p : 0,
  });

  if (isIsotropic) {
    const peak = 1.4 * pc0;
    const at = progress => {
      const loading = progress <= 0.7;
      const fraction = loading ? progress / 0.7 : (1 - progress) / 0.3;
      const p = p0 * (peak / p0) ** fraction;
      const pc = loading ? Math.max(pc0, p) : peak;
      const phase = !loading ? 'unloading' : p < pc0 ? 'elastic' : 'hardening';
      return makeState(p, 0, pc, phase);
    };
    const yieldProgress = 0.7 * Math.log(ocr) / Math.log(peak / p0);
    return { at, checkpoints: [yieldProgress, 0.7], pc0 };
  }

  // Along the drained path p′ = p′₀/(1 − η/3). Substitution into the
  // initial ellipse gives a monotone quadratic for the yield stress ratio.
  const b = ocr / 3;
  const etaYield = isUndrained
    ? m * Math.sqrt(ocr - 1)
    : 2 * (ocr - 1) / (b + Math.sqrt(b * b + 4 * (ocr - 1) / (m * m)));
  const exponent = (lambda - kappa) / lambda;

  function triaxialState(eta, elastic) {
    const stressFactor = 1 + (eta / m) ** 2;
    // Undrained plastic loading keeps v constant; solving the swelling
    // relation together with the current yield equation gives p′(η).
    const p = isUndrained
      ? elastic ? p0 : p0 * (ocr / stressFactor) ** exponent
      : p0 / (1 - eta / 3);
    const pc = elastic ? pc0 : p * stressFactor;
    const phase = elastic ? 'elastic' : etaYield > m ? 'softening' : 'hardening';
    const state = makeState(p, eta * p, pc, phase);
    state.volumetricStrain = Math.log(initialVolume / state.v);
    return state;
  }

  const elasticAxialStrain = state => state.volumetricStrain / 3 + state.q / (3 * camClayShearModulus);
  const firstYield = triaxialState(etaYield, true);
  firstYield.axialStrain = elasticAxialStrain(firstYield);
  firstYield.phase = 'yield';

  // With η = M + (η_y − M) exp(−s), the factor dη/ds = M − η
  // cancels the critical-state singularity in the associated flow rule.
  const etaAt = s => m + (etaYield - m) * Math.exp(-s);
  function plasticShearRate(s) {
    const eta = etaAt(s);
    const { v } = triaxialState(eta, false);
    const stressFactorSlope = 2 * eta / (m * m + eta * eta);
    const capSlope = isUndrained ? (kappa / lambda) * stressFactorSlope
      : 1 / (3 - eta) + stressFactorSlope;
    return (2 * eta / (m + eta)) * (lambda - kappa) / v * capSlope;
  }

  const gap = Math.abs(etaYield - m);
  const criticalDistance = gap <= m * camClayCriticalTolerance ? 0
    : Math.log(gap / (m * camClayCriticalTolerance));
  const steps = Math.ceil(criticalDistance / 0.025);
  const step = criticalDistance / Math.max(steps, 1);
  const axialStrains = [firstYield.axialStrain];
  let plasticShear = 0;
  for (let i = 1; i <= steps; i += 1) {
    const s = i * step;
    plasticShear += step * (plasticShearRate(s - step) + 4 * plasticShearRate(s - step / 2) + plasticShearRate(s)) / 6;
    axialStrains.push(elasticAxialStrain(triaxialState(etaAt(s), false)) + plasticShear);
  }

  const criticalStrain = axialStrains.at(-1);
  const maxAxialStrain = Math.max(20, 10 * Math.ceil((100 * criticalStrain + 5) / 10)) / 100;
  const criticalProgress = criticalStrain / maxAxialStrain;
  const limit = { ...triaxialState(m, false), phase: 'critical' };

  function at(progress) {
    const axialStrain = progress * maxAxialStrain;
    if (axialStrain === 0) {
      return { ...triaxialState(0, true), phase: 'initial', axialStrain };
    }
    if (Math.abs(axialStrain - firstYield.axialStrain) < 1e-12) return firstYield;
    if (axialStrain < firstYield.axialStrain) {
      let low = 0;
      let high = etaYield;
      for (let i = 0; i < 30; i += 1) {
        const mid = (low + high) / 2;
        if (elasticAxialStrain(triaxialState(mid, true)) < axialStrain) low = mid;
        else high = mid;
      }
      return { ...triaxialState((low + high) / 2, true), axialStrain };
    }
    if (progress >= criticalProgress) return { ...limit, axialStrain };

    let low = 0;
    let high = axialStrains.length - 1;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (axialStrains[mid] < axialStrain) low = mid;
      else high = mid;
    }
    const before = axialStrains[low];
    const after = axialStrains[high];
    const fraction = (axialStrain - before) / (after - before);
    const eta = etaAt((low + fraction) * step);
    return { ...triaxialState(eta, false), axialStrain };
  }

  const checkpoints = [firstYield.axialStrain / maxAxialStrain, criticalProgress];
  return { at, checkpoints, pc0, limit, maxAxialStrain };
}
