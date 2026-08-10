// Shared cart storage (wireframe demo — localStorage only, no real backend)
const KEY = 'nasap3d_cart_v1';

export function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}

function saveCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('nasap3d-cart-changed'));
}

export function addItem(item) {
  const items = getCart();
  items.push({ id: Date.now() + Math.random().toString(16).slice(2), qty: 1, ...item });
  saveCart(items);
}

export function removeItem(id) {
  saveCart(getCart().filter(i => i.id !== id));
}

export function updateQty(id, qty) {
  saveCart(getCart().map(i => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
}

export function clearCart() {
  saveCart([]);
}

export function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

export const DISCOUNT_TIERS = [
  { min: 5, pct: 5 },
  { min: 15, pct: 10 },
  { min: 50, pct: 15 },
  { min: 100, pct: 20 },
  { min: 500, pct: 30 }
];

export function discountFor(qty) {
  let pct = 0;
  for (const t of DISCOUNT_TIERS) if (qty >= t.min) pct = t.pct;
  return pct;
}

export function lineTotal(item) {
  const pct = discountFor(item.qty);
  return item.unitPrice * item.qty * (1 - pct / 100);
}

export function cartSubtotal() {
  return getCart().reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
}

export function cartTotal() {
  return getCart().reduce((sum, i) => sum + lineTotal(i), 0);
}
