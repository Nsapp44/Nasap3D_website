// Shared filament stock storage (wireframe demo — localStorage only)
const KEY = 'nasap3d_stock_v1';

const RAW = [
  ['PLA', [
    ['Jade White', '#f4f4ef'], ['Beige', '#dcc6a0'], ['Green', '#00744d'],
    ['Mistletoe Green', '#37603c'], ['Grass Green', '#61c680'], ['Turquoise', '#00b1a9'],
    ['Cobalt Blue', '#0056b3'], ['Blue', '#0057ba'], ['Ice Blue', '#a0dce8'],
    ['Cyan', '#0093c3'], ['Purple', '#6b3fa0'], ['Magenta', '#ec008c'],
    ['Pink', '#f5a7c4'], ['Red', '#c0141b'], ['Maroon Red', '#9d2235'],
    ['Orange', '#ff6a13'], ['Yellow', '#f4ee2a'], ['Gold', '#c8a951'],
    ['Silver', '#a6a9aa'], ['Gray', '#8e9089'], ['Charcoal', '#3f3f3f'],
    ['Black', '#0f0f0f'], ['Brown', '#7a4a2b'], ['Bronze', '#8c6239']
  ]],
  ['PETG HF', [
    ['White', '#f4f4ef'], ['Black', '#0f0f0f'], ['Gray', '#8e9089'],
    ['Blue', '#0057ba'], ['Green', '#3c8c47'], ['Orange', '#ff6a13'],
    ['Red', '#c0141b'], ['Yellow', '#f4ee2a'], ['Lime Green', '#a6ce39'],
    ['Peanut Brown', '#7a4a2b'], ['Translucent Teal', '#4fb3a9'], ['Dark Red', '#7c1723']
  ]],
  ['ABS', [
    ['Black', '#0f0f0f'], ['White', '#f4f4ef'], ['Red', '#c0141b'],
    ['Blue', '#0057ba'], ['Gray', '#8e9089'], ['Orange', '#ff6a13'],
    ['Yellow', '#f4ee2a'], ['Green', '#3c8c47'], ['Tangerine Yellow', '#ffb100'],
    ['Navy Blue', '#1c2b4a']
  ]],
  ['ASA', [
    ['White', '#f4f4ef'], ['Black', '#0f0f0f'], ['Gray', '#8e9089'],
    ['Red', '#c0141b'], ['Blue', '#0057ba'], ['Green', '#3c8c47']
  ]],
  ['TPU 95A', [
    ['Black', '#0f0f0f'], ['White', '#f4f4ef'], ['Red', '#c0141b'],
    ['Yellow', '#f4ee2a'], ['Blue', '#0057ba']
  ]],
  ['PA (Nylon)', [
    ['Black (CF)', '#0f0f0f'], ['Gray (CF)', '#6b6d66'], ['Natural', '#d8d3c8']
  ]],
  ['PP', [
    ['Black', '#0f0f0f'], ['White', '#f4f4ef'], ['Gray', '#8e9089']
  ]]
];

// Maps configurator material keys (used in the quote wizard) to admin stock group names
export const MATERIAL_KEY_MAP = {
  PLA: 'PLA', PETG: 'PETG HF', ABS: 'ABS', ASA: 'ASA', TPU: 'TPU 95A', PP: 'PP', Nylon: 'PA (Nylon)'
};

function buildDefault() {
  let id = 1;
  const out = [];
  RAW.forEach(([material, colors]) => {
    colors.forEach(([colorName, colorHex]) => {
      out.push({ id, material, colorName, colorHex, inStock: !(id % 4 === 0) });
      id++;
    });
  });
  return out;
}

export function getStock() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seeded = buildDefault();
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveStock(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('nasap3d-stock-changed'));
}

export function setInStock(id, inStock) {
  saveStock(getStock().map(sp => (sp.id === id ? { ...sp, inStock } : sp)));
}

// Global "instant quote online" flag (vacation mode) — admin can pause the whole quote system
const QUOTE_KEY = 'nasap3d_quote_enabled_v1';

export function isQuoteEnabled() {
  try {
    const raw = localStorage.getItem(QUOTE_KEY);
    if (raw !== null) return raw === 'true';
  } catch (e) {}
  return true;
}

export function setQuoteEnabled(on) {
  localStorage.setItem(QUOTE_KEY, on ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('nasap3d-quote-changed'));
}

// Configurator-facing helpers: which of the 7 quote materials currently have >=1 color in stock
export function materialsInStock() {
  const stock = getStock();
  return Object.keys(MATERIAL_KEY_MAP).filter(key => {
    const group = MATERIAL_KEY_MAP[key];
    return stock.some(sp => sp.material === group && sp.inStock);
  });
}

// In-stock colors for a given configurator material key
export function colorsInStock(materialKey) {
  const group = MATERIAL_KEY_MAP[materialKey];
  return getStock().filter(sp => sp.material === group && sp.inStock);
}
