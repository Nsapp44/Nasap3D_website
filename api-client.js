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

// hCaptcha requires a real, visible, user-solved widget — unlike reCAPTCHA
// v3 there is no invisible auto-minted token. Pages render the widget
// themselves (via <div class="h-captcha" data-sitekey="..."> + the
// https://js.hcaptcha.com/1/api.js script, added to each helmet that needs
// it) and pass the resulting token into these calls.
export const HCAPTCHA_SITE_KEY = '8874894e-8ac6-4344-bb7e-67541fec27b8';

// Boxtal Map widget access token — meant to run client-side (sent to the map
// iframe via postMessage, see vendor/boxtal-parcel-point-map.js), same
// category of "public" key as the hCaptcha site key above.
export const BOXTAL_MAP_ACCESS_TOKEN = 'ON9K1CQK9NO0KKDGPSC4S5K93PVV2NV4MZNEH9D7';

export const api = {
  async signup(email, password, captchaToken) {
    return request('POST', '/auth/signup', { email, password, captchaToken });
  },
  async login(email, password, captchaToken) {
    return request('POST', '/auth/login', { email, password, captchaToken });
  },
  async logout() {
    return request('POST', '/auth/logout');
  },
  async me() {
    return request('GET', '/auth/me');
  },
  async forgotPassword(email, captchaToken) {
    return request('POST', '/auth/forgot-password', { email, captchaToken });
  },
  async resetPassword(token, newPassword) {
    return request('POST', '/auth/reset-password', { token, newPassword });
  },
  async verifyEmail(code) {
    return request('POST', '/auth/verify-email', { code });
  },
  async resendVerification() {
    return request('POST', '/auth/resend-verification');
  },
  async requestEmailChange(newEmail, currentPassword) {
    return request('POST', '/account/email/request-change', { newEmail, currentPassword });
  },
  async confirmEmailChange(code) {
    return request('POST', '/account/email/confirm-change', { code });
  },
  async requestPasswordChange(currentPassword, newPassword) {
    return request('POST', '/account/password/request-change', { currentPassword, newPassword });
  },
  async confirmPasswordChange(code) {
    return request('POST', '/account/password/confirm-change', { code });
  },
  async deleteAccount(currentPassword) {
    return request('DELETE', '/account', { currentPassword });
  },
  async submitContact({ name, email, subject, message, fileKey, fileName, captchaToken }) {
    return request('POST', '/contact', { name, email, subject, message, fileKey, fileName, captchaToken });
  },
  async uploadContactFile(file) {
    const form = new FormData();
    form.append('file', file, file.name);
    let res;
    try {
      res = await fetch(apiBase() + '/contact/upload', { method: 'POST', credentials: 'include', body: form });
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'network_error' } };
    }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
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
  quoteFileUrl(id) {
    return apiBase() + '/quotes/' + id + '/file';
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
  adminOrderFileUrl(orderId, itemId) {
    return apiBase() + '/admin/orders/' + orderId + '/items/' + itemId + '/file';
  },
  async adminDeleteOrderFile(orderId, itemId) {
    return request('DELETE', '/admin/orders/' + orderId + '/items/' + itemId + '/file');
  },
  async adminBuyShippingLabel(orderId) {
    return request('POST', '/admin/orders/' + orderId + '/shipping-label');
  },
  async adminCheckShippingLabel(orderId) {
    return request('GET', '/admin/orders/' + orderId + '/shipping-label');
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
