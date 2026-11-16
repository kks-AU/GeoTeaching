const camForm = document.querySelector('#experiment');
const camProgress = document.querySelector('#progress');
const camPlay = document.querySelector('#play');
const camAxisLock = document.querySelector('#lock-axes');
const camAxisStatus = document.querySelector('#axis-status');
const camStress = document.querySelector('#stress');
const camVolume = document.querySelector('#volume');
const camResponseStack = document.querySelector('#cam-response-stack');
const camSpace = document.querySelector('#cam-space');
const camAzimuth = document.querySelector('#cam-azimuth');
const camElevation = document.querySelector('#cam-elevation');
const camView2D = document.querySelector('#cam-view-2d');
const camView3D = document.querySelector('#cam-view-3d');
const camResponseCharts = [
  { id: 'deviator-stress', yLabel: 'q (kPa)', value: state => state.q, unit: 10, digits: 1 },
  { id: 'volumetric-strain', test: 'drained', yLabel: 'εᵥ (%)', value: state => 100 * state.volumetricStrain, unit: 0.5, digits: 2 },
  { id: 'pore-pressure', test: 'undrained', yLabel: 'Δu (kPa)', value: state => state.u, unit: 10, digits: 1 },
];
const camOptions = ['ocr', 'p0', 'm', 'lambda', 'kappa', 'n', 'g'];
const camColours = Object.fromEntries(
  ['current', 'path', 'initial', 'yield', 'critical', 'normal'].map(name =>
    [name, getComputedStyle(document.body).getPropertyValue('--cam-' + name).trim()])
);
const camNumber = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const camPressure = value => camNumber.format(value) + ' kPa';

const camBoundaries = {
  drained: 'Fixed total cell pressure with drainage. Excess pore pressure stays at zero.',
  undrained: 'Fixed total cell pressure with no drainage. Specific volume stays constant.',
  isotropic: 'Equal effective stresses in all directions. The specimen is compressed past yield and unloaded to the initial stress.',
};

let camRun;
let camFrame;
let camLockedAxes;
let camShowSpace = false;

function camGrid(f, { xMin, xMax, yMin, yMax, xLabel, yLabel, xTicks, log, square, yDigits, compact = false, yTicks }) {
  const availableWidth = f.w - 45 - 19;
  const top = compact ? 23 : 28;
  const bottomMargin = xLabel ? compact ? 35 : 45 : 10;
  const availableHeight = f.h - top - bottomMargin;
  const side = Math.min(availableWidth, availableHeight);
  const width = square ? side : availableWidth;
  const height = square ? side : availableHeight;
  const left = 45 + (availableWidth - width) / 2;
  const right = left + width;
  const bottom = top + height;
  const axis = log ? Math.log : value => value;
  const x = value => left + (axis(value) - axis(xMin)) / (axis(xMax) - axis(xMin)) * (right - left);
  const y = value => bottom - (value - yMin) / (yMax - yMin) * (bottom - top);
  for (const value of xTicks) {
    f.line([[x(value), top], [x(value), bottom]], '#dfe5dc', 1);
    if (xLabel) f.label(x(value), bottom + (compact ? 14 : 17), camNumber.format(value), '#52645e', 'center');
  }
  const decimals = yDigits ?? (yMax - yMin < 1 ? 2 : 0);
  for (const value of yTicks ?? punkter(4, t => yMin + t * (yMax - yMin))) {
    f.line([[left, y(value)], [right, y(value)]], '#dfe5dc', 1);
    const tick = yDigits === undefined ? value.toFixed(decimals) : String(Number(value.toFixed(decimals)));
    f.label(left - 7, y(value) + 4, tick, '#52645e', 'right');
  }
  if (yMin < 0 && yMax > 0) f.line([[left, y(0)], [right, y(0)]], '#61736e', 1, [3, 4]);
  f.line([[left, top], [left, bottom], [right, bottom]], '#61736e', 1);
  f.label(left, 17, yLabel);
  if (xLabel) f.label(right, bottom + (compact ? 27 : 37), xLabel, '#213d37', 'right');
  return {
    point: (a, b) => [x(a), y(b)],
    contains: (a, b) => a >= xMin && a <= xMax && b >= yMin && b <= yMax,
    clip: draw => f.clipRect(left, top, right - left + 1, bottom - top + 1, draw),
  };
}

function camEllipse(pc, m, plot) {
  return punkter(110, t => {
    const angle = Math.PI * (1 - t);
    return plot.point(pc / 2 * (1 + Math.cos(angle)), m * pc / 2 * Math.sin(angle));
  });
}

function camMarkLimit(chart, point, limit) {
  if (!limit) return;
  const position = point(limit);
  chart.dot(...position, camColours.critical, 4.7);
  chart.dot(...position, '#fffef9', 2.9);
}

function camDrawResponse({ id, test, yLabel, value, digits, unit }, { response, responseXMax }, states, traced, state) {
  const chart = figur(document.getElementById(id));
  const constant = test && test !== camRun.params.test;
  const { min, max } = constant ? { min: -unit, max: unit } : response[id];
  const plot = camGrid(chart, {
    xMin: 0, xMax: responseXMax, yMin: min, yMax: max,
    xLabel: !test || constant ? 'ε₁ (%)' : '', yLabel, xTicks: punkter(4, t => t * responseXMax), yDigits: digits,
    compact: constant, yTicks: constant ? [0] : undefined,
  });
  const point = sample => plot.point(100 * sample.axialStrain, value(sample));
  plot.clip(() => {
    chart.line(states.map(point), camColours.path, 1.7);
    chart.line(traced.map(point), camColours.current, 2.7);
  });
  if (plot.contains(100 * state.axialStrain, value(state))) {
    chart.dot(...point(state), '#fff', 6.3);
    chart.dot(...point(state), camColours.current, 4.2);
  }
}

function camDraw(state, traced) {
  const { params, model, states } = camRun;
  const axes = camLockedAxes ?? camRun.axes;
  if (camShowSpace) {
    camDrawSpace(figur(camSpace), axes, params, model, states, traced, state,
      camAzimuth.valueAsNumber, camElevation.valueAsNumber, camColours, camNumber);
    return;
  }
  const { m } = params;
  const stressChart = figur(camStress);
  const stressPlot = camGrid(stressChart, {
    xMin: 0, xMax: axes.stressMax, yMin: 0, yMax: axes.stressMax,
    xLabel: 'p′ (kPa)', yLabel: 'q (kPa)', xTicks: punkter(4, t => t * axes.stressMax),
    square: true,
  });
  const stressPoint = ({ p, q }) => stressPlot.point(p, q);
  const lineEnd = axes.stressMax / Math.max(1, m);
  stressPlot.clip(() => {
    stressChart.line([stressPlot.point(0, 0), stressPlot.point(lineEnd, m * lineEnd)], camColours.critical, 1.6, [6, 4]);
    stressChart.line(camEllipse(state.pc, m, stressPlot), camColours.yield, 1.8);
    stressChart.line(camEllipse(model.pc0, m, stressPlot), camColours.initial, 1.3, [4, 4]);
    stressChart.line(states.map(stressPoint), camColours.path, 1.7);
    stressChart.line(traced.map(stressPoint), camColours.current, 2.7);
    camMarkLimit(stressChart, stressPoint, model.limit);
  });
  if (stressPlot.contains(state.p, state.q)) {
    stressChart.dot(...stressPoint(state), '#fff', 6.3);
    stressChart.dot(...stressPoint(state), camColours.current, 4.2);
  }

  const volumeChart = figur(camVolume);
  const volumePlot = camGrid(volumeChart, {
    xMin: axes.volumeXMin, xMax: axes.volumeXMax,
    yMin: axes.volumeYMin, yMax: axes.volumeYMax,
    xLabel: 'p′ (kPa, log scale)', yLabel: 'v = 1 + e', xTicks: axes.volumeTicks, log: true,
  });
  const volumePoint = ({ p, v }) => volumePlot.point(p, v);
  const reference = axes.volumeTicks;
  const normal = p => camClayVolume(p, p, params);
  const critical = p => camClayVolume(p, 2 * p, params);
  volumePlot.clip(() => {
    volumeChart.line(reference.map(p => volumePlot.point(p, normal(p))), camColours.normal, 1.6, [3, 4]);
    volumeChart.line(reference.map(p => volumePlot.point(p, critical(p))), camColours.critical, 1.6, [6, 4]);
    volumeChart.line(states.map(volumePoint), camColours.path, 1.7);
    volumeChart.line(traced.map(volumePoint), camColours.current, 2.7);
    camMarkLimit(volumeChart, volumePoint, model.limit);
  });
  if (volumePlot.contains(state.p, state.v)) {
    volumeChart.dot(...volumePoint(state), '#fff', 6.3);
    volumeChart.dot(...volumePoint(state), camColours.current, 4.2);
  }
  if (model.limit) camResponseCharts.forEach(definition =>
    camDrawResponse(definition, axes, states, traced, state));
}

function camUpdateAxisStatus() {
  const axes = camLockedAxes;
  const clipped = axes && (camRun.referenceStates.some(({ p, q, v }) =>
    p < axes.volumeXMin || p > axes.volumeXMax || v < axes.volumeYMin || v > axes.volumeYMax ||
      (camShowSpace && q > axes.spaceQMax)) ||
    (!camShowSpace && (camRun.largestPc > axes.stressMax || camRun.largestQ > axes.stressMax)) ||
    (!camShowSpace && camRun.responseCharts.length && (camRun.axes.responseXMax > axes.responseXMax ||
      camRun.responseCharts.some(({ id, value }) => {
        const { min, max } = axes.response[id];
        return camRun.states.some(state => value(state) < min || value(state) > max);
      }))));
  const message = clipped ? 'Some curves extend beyond the locked limits. Unlock the axes to see the full test.' : '';
  if (message !== camAxisStatus.textContent) camAxisStatus.textContent = message;
}

function camUpdateSetup() {
  const params = Object.fromEntries(camOptions.map(name => [name, camForm.elements[name].valueAsNumber]));
  params.test = camForm.elements.test.value;
  camOptions.forEach(name => {
    const value = params[name];
    const decimals = name === 'lambda' || name === 'kappa' || name === 'm' ? 3 : 2;
    const units = { p0: 'kPa', g: 'MPa' };
    document.querySelector('#' + name + '-value').value = units[name]
      ? camNumber.format(value) + ' ' + units[name] : value.toFixed(decimals);
  });
  document.querySelector('#boundary').textContent = camBoundaries[params.test];
  const model = camClayTest({ ...params, g: params.g * 1000 });
  const positions = [...new Set([...punkter(180, t => t), ...model.checkpoints])].sort((a, b) => a - b);
  const states = positions.map(model.at);
  const referenceStates = model.limit ? [...states, model.limit] : states;
  const largestPc = Math.max(...referenceStates.map(state => state.pc));
  const largestQ = Math.max(...referenceStates.map(state => state.q), params.m * largestPc / 2);
  const pressures = referenceStates.map(state => state.p);
  const pLow = Math.min(...pressures) * 0.74;
  const pHigh = Math.max(...pressures) * 1.32;
  const vLow = camClayVolume(pHigh, 2 * pHigh, params);
  const vHigh = camClayVolume(pLow, pLow, params);
  const volumes = [...referenceStates.map(state => state.v), vLow, vHigh];
  const ceil = (value, step) => Math.ceil(value / step) * step;
  const axes = {
    stressMax: ceil(Math.max(largestPc * 1.05, largestQ * 1.15), 40),
    spaceQMax: Math.max(20, ceil(1.12 * Math.max(...referenceStates.map(state => state.q)), 20)),
    volumeXMin: pLow,
    volumeXMax: pHigh,
    volumeYMin: Math.floor((Math.min(...volumes) - 0.012) / 0.02) * 0.02,
    volumeYMax: ceil(Math.max(...volumes) + 0.012, 0.02),
    volumeTicks: punkter(3, t => pLow * (pHigh / pLow) ** t),
  };
  const responseCharts = model.limit
    ? camResponseCharts.filter(chart => !chart.test || chart.test === params.test) : [];
  if (responseCharts.length) {
    axes.responseXMax = 100 * model.maxAxialStrain;
    axes.response = Object.fromEntries(responseCharts.map(({ id, value, unit }) => {
      const values = states.map(value);
      const min = Math.floor(Math.min(0, ...values) * 1.08 / unit) * unit;
      const max = ceil(Math.max(min < 0 ? unit : 4 * unit, ...values.map(y => y * 1.08)), unit);
      return [id, { min, max }];
    }));
    // The first run where a response varies sets its locked y limits.
    if (camLockedAxes) {
      camLockedAxes.responseXMax ??= axes.responseXMax;
      camLockedAxes.response = { ...axes.response, ...camLockedAxes.response };
    }
  }
  document.querySelector('#deviator-stress-figure').hidden = !model.limit;
  document.querySelector('#cam-response-figure').hidden = !model.limit;
  if (model.limit) {
    const upper = document.getElementById(responseCharts.find(chart => chart.test).id);
    if (camResponseStack.firstElementChild !== upper) camResponseStack.prepend(upper);
  }
  const followsAxialStrain = model.limit && !model.axialStrainReverses;
  document.querySelector('#progress-label').textContent = followsAxialStrain ? 'Axial strain' : 'Test progress';
  const progressNote = model.limit
    ? 'This test runs to ' + camNumber.format(100 * model.maxAxialStrain) + '% axial strain to show the approach to critical state and the plateau that follows.'
    : 'The slider follows the isotropic loading and unloading sequence.';
  document.querySelector('#progress-note').textContent = model.axialStrainReverses
    ? 'Axial strain decreases over part of this path. The slider follows the loading sequence. ' + progressNote
    : progressNote;
  camRun = { params, model, positions, states, referenceStates, axes, largestPc, largestQ, responseCharts };
  camUpdateAxisStatus();
  camRender();
}

function camRender() {
  const progress = camProgress.valueAsNumber / 100;
  const { model, positions, states, params } = camRun;
  const state = model.at(progress);
  const traced = states.filter((_, i) => positions[i] < progress);
  traced.push(state);
  camDraw(state, traced);
  const progressLabel = camNumber.format(model.limit ? 100 * state.axialStrain : 100 * progress) + '%';
  const readout = model.axialStrainReverses ? progressLabel + ' axial strain' : progressLabel;
  document.querySelector('#progress-value').value = readout;
  camProgress.setAttribute('aria-valuetext', readout);
  document.querySelector('#mean-value').textContent = camPressure(state.p);
  document.querySelector('#deviator-value').textContent = camPressure(state.q);
  document.querySelector('#stress-ratio-value').textContent = (state.q / state.p).toFixed(4);
  document.querySelector('#yield-value').textContent = camPressure(state.pc);
  document.querySelector('#pore-value').textContent = camPressure(state.u);
  document.querySelector('#volume-value').textContent = state.v.toFixed(3);

  const messages = {
    initial: ['Initial isotropic state', 'The axial and radial effective stresses are equal.'],
    elastic: ['Elastic loading', 'The stress state is inside the initial yield ellipse. Its size stays constant.'],
    yield: ['First yield', 'The stress path reaches the initial yield ellipse. Continued loading produces plastic strain.'],
    hardening: ['Plastic compression and hardening', 'The stress point lies on the yield ellipse. Plastic compression raises the yield pressure and expands the ellipse.'],
    softening: ['Plastic dilation and softening', 'The stress point lies on the yield ellipse. Plastic dilation lowers the yield pressure and shrinks the ellipse.'],
    unloading: ['Elastic unloading', 'The specimen swells as mean effective stress falls. The yield ellipse retains the size reached at peak pressure.'],
    critical: ['Critical state', 'Plastic shear continues at q = Mp′ with constant effective stresses and specific volume.'],
  };
  const [phase, description] = messages[state.phase];
  document.querySelector('#phase').textContent = phase;
  document.querySelector('#interpretation').textContent = state.phase === 'softening' && params.test === 'undrained'
    ? description + ' The overall volume stays constant as the elastic volume change offsets dilation.'
    : description;
}

function camStop() {
  cancelAnimationFrame(camFrame);
  camFrame = undefined;
  camPlay.textContent = 'Play';
}

camPlay.addEventListener('click', () => {
  if (camFrame !== undefined) {
    camStop();
    return;
  }
  const start = camProgress.valueAsNumber === 100 ? 0 : camProgress.valueAsNumber;
  const time = performance.now();
  camPlay.textContent = 'Pause';
  function tick(now) {
    const next = Math.min(100, Math.round(start + (now - time) / 70));
    if (next !== camProgress.valueAsNumber) {
      camProgress.value = next;
      camRender();
    }
    if (next === 100) camStop();
    else camFrame = requestAnimationFrame(tick);
  }
  camFrame = requestAnimationFrame(tick);
});

camProgress.addEventListener('input', () => { camStop(); camRender(); });
function camSelectView(showSpace) {
  camShowSpace = showSpace;
  camView2D.setAttribute('aria-pressed', String(!showSpace));
  camView3D.setAttribute('aria-pressed', String(showSpace));
  document.querySelector('#cam-plots-2d').hidden = showSpace;
  document.querySelector('#cam-plots-3d').hidden = !showSpace;
  document.querySelectorAll('[data-cam-view="2d"]').forEach(item => { item.hidden = showSpace; });
  camUpdateAxisStatus();
  camRender();
}
camView2D.addEventListener('click', () => camSelectView(false));
camView3D.addEventListener('click', () => camSelectView(true));
for (const slider of [camAzimuth, camElevation]) {
  slider.addEventListener('input', () => {
    document.getElementById(slider.id + '-value').value = slider.value + '°';
    camRender();
  });
}
camAxisLock.addEventListener('change', () => {
  camLockedAxes = camAxisLock.checked ? camRun.axes : undefined;
  camUpdateAxisStatus();
  camRender();
});
camForm.addEventListener('input', () => { camStop(); camUpdateSetup(); });
camForm.querySelectorAll('[data-ocr]').forEach(button => {
  button.addEventListener('click', () => {
    camStop();
    camForm.elements.ocr.value = button.dataset.ocr;
    camUpdateSetup();
  });
});
camForm.addEventListener('reset', () => {
  camStop();
  camProgress.value = camProgress.defaultValue;
  requestAnimationFrame(camUpdateSetup);
});

camUpdateSetup();
if (camAxisLock.checked) camLockedAxes = camRun.axes;
const camResize = new ResizeObserver(camRender);
camResize.observe(camStress);
camResize.observe(camSpace);
