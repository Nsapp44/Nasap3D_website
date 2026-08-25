// Shared front-end client for the real back-end API (server/). Replaces the
// localStorage-based auth/contact logic page by page — see
// HANDOFF_CLAUDE_CODE.md. Every call sends cookies (credentials: 'include')
// since auth is a single httpOnly session cookie, never a token in JS.

export function apiBase() {
  if (typeof window !== 'undefined' && window.NASAP3D_API_BASE) return window.NASAP3D_API_BASE;
  if (typeof location === 'undefined') return '';
  const host = location.hostname;
  // Local dev: front on localhost:8080 (python http.server), API on
  // localhost:3000 (npm run dev / docker-compose, both same host).
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${location.protocol}//${host}:3000`;
  }
  // Production: the API lives on the "api." subdomain (api.nasap3d.com),
  // reverse-proxied on the standard HTTPS port — never :3000 directly,
  // which isn't publicly exposed on purpose (see docker-compose.yml).
  // Previously this fell through to the same :3000 default as local dev,
  // which doesn't exist in prod (connection refused on every request) —
  // the window.NASAP3D_API_BASE override this was meant to need was never
  // actually set anywhere, so deriving it here removes that dependency.
  const bareHost = host.replace(/^www\./, '');
  return `${location.protocol}//api.${bareHost}`;
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

export const api = {
  async signup(email, password, captchaToken) {
    return request('POST', '/auth/signup', { email, password, captchaToken });
  },
  async login(email, password, captchaToken, rememberMe) {
    return request('POST', '/auth/login', { email, password, captchaToken, rememberMe: !!rememberMe });
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
  async confirmSignup(pendingId, code) {
    return request('POST', '/auth/signup/confirm', { pendingId, code });
  },
  async resendSignupCode(pendingId) {
    return request('POST', '/auth/signup/resend', { pendingId });
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
  async submitQuote({ file, material, colorId, quality, infillPct, quantity, scale }) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('material', material);
    form.append('colorId', colorId);
    form.append('quality', quality);
    form.append('infillPct', String(infillPct));
    form.append('quantity', String(quantity));
    // Unit-mistake correction from the Unité/Échelle panel (see
    // Home.dc.html/Devis Instantane.dc.html _effectiveScale()) — a raw
    // multiplication factor, 1 = file as-is. Server re-derives the real
    // price/weight/time from this via PrusaSlicer's own --scale, never
    // trusted as a price input on its own (see routes/quotes.ts).
    if (scale !== undefined) form.append('scale', String(scale));
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
  async getQuoteEnabled() {
    return request('GET', '/quote-enabled');
  },
  async getGoogleRating() {
    return request('GET', '/google-rating');
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
  async adminGetOrders(status, q) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const qs = params.toString();
    return request('GET', '/admin/orders' + (qs ? '?' + qs : ''));
  },
  async adminUpdateOrderStatus(orderId, status) {
    return request('PATCH', '/admin/orders/' + orderId, { status });
  },
  async adminAcceptOrder(orderId) {
    return request('POST', '/admin/orders/' + orderId + '/accept');
  },
  async adminRejectOrder(orderId) {
    return request('POST', '/admin/orders/' + orderId + '/reject');
  },
  adminOrderFileUrl(orderId, itemId) {
    return apiBase() + '/admin/orders/' + orderId + '/items/' + itemId + '/file';
  },
  adminOrderLabelDownloadUrl(orderId) {
    return apiBase() + '/admin/orders/' + orderId + '/shipping-label/download';
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
  async adminSetTrackingNumber(orderId, trackingNumber) {
    return request('PATCH', '/admin/orders/' + orderId, { trackingNumber });
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
  async getBoxtalMapToken() {
    return request('GET', '/shipping/map-token');
  },
  async checkout(shipping) {
    return request('POST', '/checkout', { shipping });
  },
  async payOrder(orderId) {
    return request('POST', '/orders/' + orderId + '/pay');
  },
  async cancelOrder(orderId) {
    return request('DELETE', '/orders/' + orderId);
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
