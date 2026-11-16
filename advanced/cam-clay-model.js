const camClayReference = { pressure: 1, volume: 2.8 };

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
  const plasticDistance = Math.abs(m - etaYield);
  const yieldProgress = etaYield / (etaYield + plasticDistance);
  const exponent = (lambda - kappa) / lambda;

  function at(progress) {
    if (progress === 0) return makeState(p0, 0, pc0, 'initial');
    const elastic = progress < yieldProgress;
    const eta = elastic
      ? etaYield * progress / yieldProgress
      : m + (etaYield - m) * (1 - progress) / (1 - yieldProgress || 1);
    const stressFactor = 1 + (eta / m) ** 2;
    // Undrained plastic loading keeps v constant; solving the swelling
    // relation together with the current yield equation gives p′(η).
    const p = isUndrained
      ? elastic ? p0 : p0 * (ocr / stressFactor) ** exponent
      : p0 / (1 - eta / 3);
    const pc = elastic ? pc0 : p * stressFactor;
    const phase = progress === 1 ? 'critical' : elastic ? 'elastic'
      : etaYield > m ? 'softening' : 'hardening';
    return makeState(p, eta * p, pc, phase);
  }
  return { at, checkpoints: [yieldProgress], pc0 };
}
