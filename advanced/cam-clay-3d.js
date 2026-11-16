// Clip a normalized segment to the plot box before projecting it.
function camSpaceSegment(start, end) {
  let from = 0;
  let to = 1;
  const delta = end.map((value, i) => value - start[i]);
  for (let i = 0; i < 3; i += 1) {
    if (delta[i] === 0) {
      if (start[i] < 0 || start[i] > 1) return null;
      continue;
    }
    const near = -start[i] / delta[i];
    const far = (1 - start[i]) / delta[i];
    from = Math.max(from, Math.min(near, far));
    to = Math.min(to, Math.max(near, far));
    if (from > to) return null;
  }
  return {
    start: from === 0 ? start : start.map((value, i) => value + from * delta[i]),
    end: to === 1 ? end : start.map((value, i) => value + to * delta[i]),
  };
}

function camDrawSpace(chart, axes, params, model, states, traced, state, azimuth, elevation, colours, number) {
  const pMin = axes.volumeXMin;
  const pMax = axes.volumeXMax;
  const qMax = axes.spaceQMax;
  const vMin = axes.volumeYMin;
  const vMax = axes.volumeYMax;
  const az = azimuth * Math.PI / 180;
  const el = elevation * Math.PI / 180;

  function flatten([x, y, z]) {
    return [
      Math.cos(az) * x - Math.sin(az) * y,
      Math.sin(el) * (Math.sin(az) * x + Math.cos(az) * y) - Math.cos(el) * z,
    ];
  }

  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const footprint = corners.map(flatten);
  const left = Math.min(...footprint.map(([x]) => x));
  const right = Math.max(...footprint.map(([x]) => x));
  const top = Math.min(...footprint.map(([, y]) => y));
  const bottom = Math.max(...footprint.map(([, y]) => y));
  const sidePadding = Math.min(62, chart.w * 0.20);
  const factor = Math.min((chart.w - 2 * sidePadding) / (right - left), (chart.h - 78) / (bottom - top));
  const project = point => {
    const [x, y] = flatten(point);
    return [chart.w / 2 + factor * (x - (left + right) / 2),
      chart.h / 2 + factor * (y - (top + bottom) / 2)];
  };
  const normalize = ({ p, q, v }) => [
    (p - pMin) / (pMax - pMin), q / qMax, (v - vMin) / (vMax - vMin),
  ];
  const segment = (a, b, colour, width = 1) => chart.line([project(a), project(b)], colour, width);

  for (const t of punkter(4, t => t)) {
    segment([t, 0, 0], [t, 1, 0], '#d6dfd5');
    segment([0, t, 0], [1, t, 0], '#d6dfd5');
    segment([0, 0, t], [1, 0, t], '#e3e9df');
    segment([0, 0, t], [0, 1, t], '#e3e9df');
  }
  for (const [a, b] of [[1, 2], [2, 3], [1, 5], [3, 7], [4, 5], [4, 7]]) {
    segment(corners[a], corners[b], '#d6dfd5');
  }
  for (const i of [1, 3, 4]) segment(corners[0], corners[i], '#647770', 1.5);

  const ticks = chart.w < 420 ? [0.5, 1] : [0.25, 0.5, 0.75, 1];
  const tickColour = '#52645e';
  const labelColour = '#213d37';
  for (const t of ticks) {
    const [px, py] = project([t, 0, 0]);
    const [qx, qy] = project([0, t, 0]);
    const [vx, vy] = project([0, 0, t]);
    chart.label(px + 7, py + 14, number.format(pMin + t * (pMax - pMin)), tickColour);
    chart.label(qx - 7, qy + 14, number.format(t * qMax), tickColour, 'right');
    chart.label(vx - 8, vy + 4, (vMin + t * (vMax - vMin)).toFixed(2), tickColour, 'right');
  }
  const [px, py] = project(corners[1]);
  const [qx, qy] = project(corners[3]);
  const [vx, vy] = project(corners[4]);
  chart.label(Math.min(px + 7, chart.w - 52), py + 32, 'p′ (kPa)', labelColour);
  chart.label(Math.max(qx - 7, 50), qy + 32, 'q (kPa)', labelColour, 'right');
  chart.label(vx - 8, vy - 12, 'v', labelColour, 'right');

  function drawPath(samples, colour, width, dash = []) {
    const points = samples.map(normalize);
    let visible = [];
    for (let i = 1; i < points.length; i += 1) {
      const clipped = camSpaceSegment(points[i - 1], points[i]);
      if (!clipped || clipped.start !== points[i - 1]) {
        chart.line(visible, colour, width, dash);
        visible = [];
      }
      if (clipped) {
        if (!visible.length) visible.push(project(clipped.start));
        visible.push(project(clipped.end));
      }
    }
    chart.line(visible, colour, width, dash);
  }

  const pressures = punkter(80, t => pMin + t * (pMax - pMin));
  drawPath(pressures.map(p => ({ p, q: 0, v: camClayVolume(p, p, params) })), colours.normal, 1.6, [3, 4]);
  drawPath(pressures.map(p => ({ p, q: params.m * p, v: camClayVolume(p, 2 * p, params) })), colours.critical, 1.6, [6, 4]);
  drawPath(states, colours.path, 1.7);
  drawPath(traced, colours.current, 2.7);

  function mark(sample, outerColour, innerColour) {
    const point = normalize(sample);
    if (!point.every(value => value >= 0 && value <= 1)) return;
    chart.dot(...project(point), outerColour, 5.8);
    chart.dot(...project(point), innerColour, 3.7);
  }
  if (model.limit) mark(model.limit, colours.critical, '#fffef9');
  mark(state, '#fffef9', colours.current);
}
