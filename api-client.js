// Shared front-end client for the real back-end API (server/). Replaces the
// localStorage-based auth/contact logic page by page — see
// HANDOFF_CLAUDE_CODE.md. Every call sends cookies (credentials: 'include')
// since auth is a single httpOnly session cookie, never a token in JS.

function apiBase() {
  if (typeof window !== 'undefined' && window.NASAP3D_API_BASE) return window.NASAP3D_API_BASE;
  if (typeof location === 'undefined') return '';
  // Same-host default: works for local dev (localhost:8080 -> localhost:3000)
  // and for a prod deploy that exposes the API on a different port of the
  // same hostname. Override by setting window.NASAP3D_API_BASE before this
  // script loads if the API lives elsewhere (subdomain, reverse-proxy path).
  return `${location.protocol}//${location.hostname}:3000`;
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(apiBase() + path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

// reCAPTCHA v3 is invisible — no checkbox, just a token minted per action.
// The <script src="https://www.google.com/recaptcha/api.js?render=SITE_KEY">
// tag must be present on the page (added to each helmet that needs it).
const RECAPTCHA_SITE_KEY = '6Lc-5X4tAAAAAKV1mRgZz7YEzvqBT4lEbqvsOTGi';

// Boxtal Map widget access token — meant to run client-side (sent to the map
// iframe via postMessage, see vendor/boxtal-parcel-point-map.js), same
// category of "public" key as the reCAPTCHA site key above.
export const BOXTAL_MAP_ACCESS_TOKEN = 'ON9K1CQK9NO0KKDGPSC4S5K93PVV2NV4MZNEH9D7';

function getRecaptchaToken(action) {
  return new Promise((resolve) => {
    const g = typeof window !== 'undefined' ? window.grecaptcha : null;
    if (!g) { resolve(undefined); return; }
    g.ready(() => {
      g.execute(RECAPTCHA_SITE_KEY, { action }).then(resolve).catch(() => resolve(undefined));
    });
  });
}

export const api = {
  async signup(email, password) {
    const recaptchaToken = await getRecaptchaToken('signup');
    return request('POST', '/auth/signup', { email, password, recaptchaToken });
  },
  async login(email, password) {
    const recaptchaToken = await getRecaptchaToken('login');
    return request('POST', '/auth/login', { email, password, recaptchaToken });
  },
  async logout() {
    return request('POST', '/auth/logout');
  },
  async me() {
    return request('GET', '/auth/me');
  },
  async forgotPassword(email) {
    const recaptchaToken = await getRecaptchaToken('forgot_password');
    return request('POST', '/auth/forgot-password', { email, recaptchaToken });
  },
  async resetPassword(token, newPassword) {
    return request('POST', '/auth/reset-password', { token, newPassword });
  },
  async changeEmail(newEmail, currentPassword) {
    return request('PATCH', '/account/email', { newEmail, currentPassword });
  },
  async changePassword(currentPassword, newPassword) {
    return request('PATCH', '/account/password', { currentPassword, newPassword });
  },
  async deleteAccount(currentPassword) {
    return request('DELETE', '/account', { currentPassword });
  },
  async submitContact({ name, email, subject, message, fileKey }) {
    const recaptchaToken = await getRecaptchaToken('contact');
    return request('POST', '/contact', { name, email, subject, message, fileKey, recaptchaToken });
  },
  async getMaterials() {
    return request('GET', '/materials');
  },
  async submitQuote({ file, material, colorId, quality, infillPct, quantity }) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('material', material);
    form.append('colorId', colorId);
    form.append('quality', quality);
    form.append('infillPct', String(infillPct));
    form.append('quantity', String(quantity));
    let res;
    try {
      res = await fetch(apiBase() + '/quotes', { method: 'POST', credentials: 'include', body: form });
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'network_error' } };
    }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  },
  async getQuote(id) {
    return request('GET', '/quotes/' + id);
  },
  async getDiscountTiers() {
    return request('GET', '/discount-tiers');
  },
  // ---- Admin ----
  async adminGetMaterials() {
    return request('GET', '/admin/materials');
  },
  async adminUpdateMaterialPrice(materialId, pricePerKgCents) {
    return request('PATCH', '/admin/materials/' + materialId, { pricePerKgCents });
  },
  async adminUpdateColorStock(materialId, colorId, inStock) {
    return request('PATCH', '/admin/materials/' + materialId + '/colors/' + colorId, { inStock });
  },
  async adminGetOrders(status) {
    return request('GET', '/admin/orders' + (status ? '?status=' + status : ''));
  },
  async adminUpdateOrderStatus(orderId, status) {
    return request('PATCH', '/admin/orders/' + orderId, { status });
  },
  async adminRejectOrder(orderId) {
    return request('DELETE', '/admin/orders/' + orderId);
  },
  async adminGetSettings() {
    return request('GET', '/admin/settings');
  },
  async adminUpdateSettings(patch) {
    return request('PATCH', '/admin/settings', patch);
  },
  // ---- Cart / checkout ----
  async getCart() {
    return request('GET', '/cart');
  },
  async addCartItem(quoteJobId, qty) {
    return request('POST', '/cart', { quoteJobId, qty });
  },
  async updateCartItem(id, qty) {
    return request('PATCH', '/cart/' + id, { qty });
  },
  async removeCartItem(id) {
    return request('DELETE', '/cart/' + id);
  },
  async getShippingRates(recipient) {
    return request('POST', '/shipping/rates', recipient);
  },
  async checkout(shipping) {
    return request('POST', '/checkout', { shipping });
  },
  async getOrders() {
    return request('GET', '/orders');
  },
  async getInvoices() {
    return request('GET', '/invoices');
  },
  invoicePdfUrl(id) {
    return apiBase() + '/invoices/' + id + '/pdf';
  },
};
