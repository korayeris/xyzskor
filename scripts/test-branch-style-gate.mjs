import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const styleLoaderSource = await readFile(new URL('../assets/js/style-loader.js', import.meta.url), 'utf8');
const appBootSource = await readFile(new URL('../assets/js/app-boot.js', import.meta.url), 'utf8');

function createLink() {
  return {
    id: '',
    media: 'print',
    parentNode: null,
    nextSibling: null,
    onload: null,
    onerror: null,
    cloneNode() { return createLink(); },
    removeAttribute(name) {
      if (name === 'onload') this.onload = null;
    },
  };
}

function createTemplate() {
  return { content: { firstElementChild: createLink() } };
}

const classNames = new Set();
const nodes = new Map([
  ['xyzCoreStyleTemplate', createTemplate()],
  ['xyzLegacyStyleTemplate', createTemplate()],
  ['xyzVolleyballCenterStyleTemplate', createTemplate()],
]);
const timers = [];
const head = {
  appendChild(node) { insert(node); },
  insertBefore(node) { insert(node); },
};
function insert(node) {
  node.parentNode = head;
  nodes.set(node.id, node);
}
nodes.set('xyzFootballControlsStyle', { id: 'xyzFootballControlsStyle', parentNode: head });

const sandbox = {
  document: {
    readyState: 'loading',
    head,
    documentElement: {
      classList: {
        add(name) { classNames.add(name); },
        remove(name) { classNames.delete(name); },
        contains(name) { return classNames.has(name); },
      },
    },
    getElementById(id) { return nodes.get(id) || null; },
  },
  location: { pathname: '/voleybol/', search: '' },
  URL,
  URLSearchParams,
  Promise,
  Set,
  Object,
  Boolean,
  String,
  setTimeout(callback) {
    timers.push(callback);
    return timers.length;
  },
};
sandbox.window = sandbox;
vm.runInNewContext(styleLoaderSource, sandbox, { filename: 'assets/js/style-loader.js' });

const stylesReady = sandbox.ensureXYZBranchStyles('voleybol');
await Promise.resolve();
await Promise.resolve();

assert.equal(classNames.has('xyz-branch-css-pending'), true, 'Direct-load branch gate starts closed.');
assert.ok(nodes.get('xyzLegacyStylesheet'), 'Legacy stylesheet starts loading.');
assert.ok(nodes.get('xyzCoreStylesheet'), 'Core stylesheet starts loading.');
assert.equal(nodes.has('xyzVolleyballCenterStylesheet'), false, 'Product stylesheet attachment stays deferred until its cascade anchor can exist.');

nodes.get('xyzCoreStylesheet').onload();
nodes.get('xyzLegacyStylesheet').onload();
await Promise.resolve();
await Promise.resolve();

assert.equal(classNames.has('xyz-branch-css-pending'), true, 'Legacy CSS alone cannot open the direct-load visibility gate.');
assert.equal(classNames.has('xyz-branch-css-ready'), false, 'Ready is not exposed before product CSS settles.');

while (timers.length) timers.shift()();
const productLink = nodes.get('xyzVolleyballCenterStylesheet');
assert.ok(productLink, 'The product stylesheet is attached after the initial parse turn.');
productLink.onload();
await stylesReady;

assert.equal(classNames.has('xyz-branch-css-pending'), false, 'The gate opens after legacy and product CSS both settle.');
assert.equal(classNames.has('xyz-branch-css-ready'), true, 'The successful combined style contract publishes ready state.');

const postChunkSection = appBootSource.slice(appBootSource.indexOf('var routePostChunks = postChunksForRoute()'));
assert.match(
  postChunkSection,
  /var initialBranchStylesReady = branchStylesForProduct\(path\)[\s\S]*Promise\.resolve\(initialBranchStylesReady\)[\s\S]*\.then\(function \(\) \{ return loadSequence\(routePostChunks, true\); \}\)/,
  'Initial branch chunks must evaluate only after route-specific styles settle.',
);

console.log('Branch style gate regression checks passed.');
