const camForm = document.querySelector('#experiment');
const camProgress = document.querySelector('#progress');
const camPlay = document.querySelector('#play');
const camStress = document.querySelector('#stress');
const camVolume = document.querySelector('#volume');
const camOptions = ['ocr', 'p0', 'm', 'lambda', 'kappa'];
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

function camGrid(f, { xMin, xMax, yMin, yMax, xLabel, yLabel, xTicks, log }) {
  const left = 45;
  const right = f.w - 19;
  const top = 28;
  const bottom = f.h - 45;
  const axis = log ? Math.log : value => value;
  const x = value => left + (axis(value) - axis(xMin)) / (axis(xMax) - axis(xMin)) * (right - left);
  const y = value => bottom - (value - yMin) / (yMax - yMin) * (bottom - top);
  for (const value of xTicks) {
    f.line([[x(value), top], [x(value), bottom]], '#dfe5dc', 1);
    f.label(x(value), bottom + 17, camNumber.format(value), '#52645e', 'center');
  }
  const decimals = yMax - yMin < 1 ? 2 : 0;
  for (let i = 0; i <= 4; i += 1) {
    const value = yMin + i / 4 * (yMax - yMin);
    f.line([[left, y(value)], [right, y(value)]], '#dfe5dc', 1);
    f.label(left - 7, y(value) + 4, value.toFixed(decimals), '#52645e', 'right');
  }
  f.line([[left, top], [left, bottom], [right, bottom]], '#61736e', 1);
  f.label(left, 17, yLabel);
  f.label(right, f.h - 8, xLabel, '#213d37', 'right');
  return {
    point: (a, b) => [x(a), y(b)],
    clip: draw => f.clipRect(left, top, right - left + 1, bottom - top + 1, draw),
  };
}

function camEllipse(pc, m, plot) {
  return punkter(110, t => {
    const angle = Math.PI * (1 - t);
    return plot.point(pc / 2 * (1 + Math.cos(angle)), m * pc / 2 * Math.sin(angle));
  });
}

function camDraw(state, traced) {
  const { params, model, states, axes } = camRun;
  const { m, lambda, kappa } = params;
  const stressChart = figur(camStress);
  const stressPlot = camGrid(stressChart, {
    xMin: 0, xMax: axes.stressX, yMin: 0, yMax: axes.stressY,
    xLabel: 'p′ (kPa)', yLabel: 'q (kPa)', xTicks: punkter(4, t => t * axes.stressX),
  });
  const stressPoint = ({ p, q }) => stressPlot.point(p, q);
  const lineEnd = Math.min(axes.stressX, axes.stressY / m);
  stressPlot.clip(() => {
    stressChart.line([stressPlot.point(0, 0), stressPlot.point(lineEnd, m * lineEnd)], camColours.critical, 1.6, [6, 4]);
    stressChart.line(camEllipse(state.pc, m, stressPlot), camColours.yield, 1.8);
    stressChart.line(camEllipse(model.pc0, m, stressPlot), camColours.initial, 1.3, [4, 4]);
    stressChart.line(states.map(stressPoint), camColours.path, 1.7);
    stressChart.line(traced.map(stressPoint), camColours.current, 2.7);
  });
  stressChart.dot(...stressPoint(state), '#fff', 6.3);
  stressChart.dot(...stressPoint(state), camColours.current, 4.2);

  const volumeChart = figur(camVolume);
  const volumePlot = camGrid(volumeChart, {
    xMin: axes.volumeXMin, xMax: axes.volumeXMax,
    yMin: axes.volumeYMin, yMax: axes.volumeYMax,
    xLabel: 'p′ (kPa, log scale)', yLabel: 'v = 1 + e', xTicks: axes.volumeTicks, log: true,
  });
  const volumePoint = ({ p, v }) => volumePlot.point(p, v);
  const reference = axes.volumeTicks;
  const normal = p => camClayVolume(p, p, lambda, kappa);
  const critical = p => camClayVolume(p, 2 * p, lambda, kappa);
  volumePlot.clip(() => {
    volumeChart.line(reference.map(p => volumePlot.point(p, normal(p))), camColours.normal, 1.6, [3, 4]);
    volumeChart.line(reference.map(p => volumePlot.point(p, critical(p))), camColours.critical, 1.6, [6, 4]);
    volumeChart.line(states.map(volumePoint), camColours.path, 1.7);
    volumeChart.line(traced.map(volumePoint), camColours.current, 2.7);
  });
  volumeChart.dot(...volumePoint(state), '#fff', 6.3);
  volumeChart.dot(...volumePoint(state), camColours.current, 4.2);
}

function camUpdateSetup() {
  const params = Object.fromEntries(camOptions.map(name => [name, camForm.elements[name].valueAsNumber]));
  params.test = camForm.elements.test.value;
  camOptions.forEach(name => {
    const value = params[name];
    const decimals = name === 'lambda' || name === 'kappa' || name === 'm' ? 3 : 2;
    document.querySelector('#' + name + '-value').value =
      name === 'p0' ? camPressure(value) : value.toFixed(decimals);
  });
  document.querySelector('#boundary').textContent = camBoundaries[params.test];
  const model = camClayTest(params);
  const positions = [...new Set([...punkter(180, t => t), ...model.checkpoints])].sort((a, b) => a - b);
  const states = positions.map(model.at);
  const largestPc = Math.max(...states.map(state => state.pc));
  const largestQ = Math.max(...states.map(state => state.q), params.m * largestPc / 2);
  const pressures = states.map(state => state.p);
  const pLow = Math.min(...pressures) * 0.74;
  const pHigh = Math.max(...pressures) * 1.32;
  const vLow = camClayVolume(pHigh, 2 * pHigh, params.lambda, params.kappa);
  const vHigh = camClayVolume(pLow, pLow, params.lambda, params.kappa);
  const volumes = [...states.map(state => state.v), vLow, vHigh];
  const ceil = (value, step) => Math.ceil(value / step) * step;
  const axes = {
    stressX: ceil(largestPc * 1.05, 40),
    stressY: ceil(largestQ * 1.15, 40),
    volumeXMin: pLow,
    volumeXMax: pHigh,
    volumeYMin: Math.floor((Math.min(...volumes) - 0.012) / 0.02) * 0.02,
    volumeYMax: ceil(Math.max(...volumes) + 0.012, 0.02),
    volumeTicks: punkter(3, t => pLow * (pHigh / pLow) ** t),
  };
  camRun = { params, model, positions, states, axes };
  camRender();
}

function camRender() {
  const progress = camProgress.valueAsNumber / 100;
  const { model, positions, states, params } = camRun;
  const state = model.at(progress);
  const traced = states.filter((_, i) => positions[i] < progress);
  traced.push(state);
  camDraw(state, traced);
  document.querySelector('#progress-value').value = camProgress.value + '%';
  document.querySelector('#mean-value').textContent = camPressure(state.p);
  document.querySelector('#deviator-value').textContent = camPressure(state.q);
  document.querySelector('#yield-value').textContent = camPressure(state.pc);
  document.querySelector('#pore-value').textContent = camPressure(state.u);
  document.querySelector('#volume-value').textContent = state.v.toFixed(3);

  const messages = {
    initial: ['Initial isotropic state', 'The axial and radial effective stresses are equal.'],
    elastic: ['Elastic loading', 'The stress state is inside the initial yield ellipse. Its size stays constant.'],
    hardening: ['Plastic compression and hardening', 'The stress point lies on the yield ellipse. Plastic compression raises the yield pressure and expands the ellipse.'],
    softening: ['Plastic dilation and softening', 'The stress point lies on the yield ellipse. Plastic dilation lowers the yield pressure and shrinks the ellipse.'],
    unloading: ['Elastic unloading', 'The specimen swells as mean effective stress falls. The yield ellipse retains the size reached at peak pressure.'],
    critical: ['Critical state', 'At the limiting state q = Mp′, plastic shear can continue at constant stress and constant specific volume.'],
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
new ResizeObserver(camRender).observe(camStress);
