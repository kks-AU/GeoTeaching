// Run with: node tests/styrke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'eksempler/styrke.html'), 'utf8');
const nodes = new Map();
function element() {
  return {
    children: [], listeners: {}, clientWidth: 600, innerHTML: '',
    getBoundingClientRect: () => ({width: 600, height: 345}),
    getContext: () => new Proxy({}, {get: () => () => {}}),
    setAttribute() {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    querySelector(selector) {
      this.fields ??= {};
      return this.fields[selector] ??= element();
    }
  };
}
for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
  assert(!nodes.has(match[1]), `Duplicate id: ${match[1]}`);
  nodes.set(match[1], element());
}
const context = vm.createContext({
  document: {
    body: {dataset: {topic: 'styrke'}},
    getElementById: id => nodes.get(id) ?? null,
    createElement: element
  },
  window: {devicePixelRatio: 1},
  ResizeObserver: class { observe() {} }
});
// Execute the scripts referenced by the real page, including its render pipeline.
for (const match of html.matchAll(/<script defer src="([^"?]+)(?:\?[^"]*)?"/g)) {
  const file = path.resolve(root, 'eksempler', match[1]);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
}
function input(id, value) {
  const row = nodes.get('indstillinger').children.find(row => row.innerHTML.includes(`id="in-${id}"`));
  assert(row, `Missing control: ${id}`);
  const slider = row.fields.input;
  slider.valueAsNumber = value;
  slider.listeners.input();
}
const metrics = () => nodes.get('resultater').innerHTML;
assert(metrics().includes('Aktuel s′'));
assert(metrics().includes('Aktuel t'));
input('load', 0);
assert(metrics().includes('Aktuel t<strong>0 kPa'));
input('load', 100);
assert(metrics().includes('Aktuel σ′₁'));
input('tau1', 110);
input('tau2', 5);
assert.equal(metrics(), '');
assert(nodes.get('figurtekst').textContent.includes('Justér'));
nodes.get('nulstil').listeners.click();
assert(metrics().includes('Aktuel s′'));

vm.runInContext('globalThis.strengthModel = models.styrke', context);
const f = {w: 600, h: 345, line() {}, label() {}, dot() {}, clipRect(x,y,w,h,draw) {draw();}};
let cases = 0;
for (const tau1 of [5,38,110]) for (const tau2 of [5,96,230])
for (const s3 of [20,70,130]) for (const load of [0,85,100]) {
  const result = context.strengthModel.draw(f, {tau1,tau2,s3,load,plotScale:0});
  context.strengthModel.drawExtra(f, result);
  if (result.stressPath) {
    const p = result.stressPath;
    const limit = p.s*Math.sin(p.phi)+p.c*Math.cos(p.phi);
    assert(Math.abs(p.t-(p.s-s3)) < 1e-9);
    assert(p.t <= limit+1e-9);
    if (load === 100) assert(Math.abs(p.t-limit) < 1e-9);
    if (load === 0) assert(p.t === 0 && p.s === s3);
    assert(result.metrics.every(metric => Number.isFinite(metric[1])));
  } else assert.equal(result.metrics.length, 0);
  cases++;
}
console.log(`Page integration and ${cases} stress-path cases passed.`);
