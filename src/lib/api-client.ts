// Shared front-end client for the API — now the same Astro SSR app as the
// front-end itself (src/pages/api/), not a separate backend process.
// Same-origin as of the SSR migration: every call below is a relative
// /api/... path, no cross-origin request, no CORS layer needed for the
// site's own front-end. Auth is a single httpOnly session cookie, never a
// token in JS, so every call sends credentials.

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}

declare global {
  interface Window {
    NASAP3D_API_BASE?: string;
  }
}

// Kept as a function (not a plain constant) so window.NASAP3D_API_BASE can
// still override it — used for local diagnostic scripts that point a page
// at a different running instance without editing this file (see this
// session's hCaptcha-dev-bypass testing pattern).
export function apiBase(): string {
  if (typeof window !== "undefined" && window.NASAP3D_API_BASE) return window.NASAP3D_API_BASE;
  return "/api";
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(apiBase() + path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null };
  }
  let data: T | null = null;
  try {
    data = await res.json();
  } catch {
    // no/invalid JSON body — data stays null
  }
  return { ok: res.ok, status: res.status, data };
}

async function requestForm<T = unknown>(path: string, form: FormData): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(apiBase() + path, { method: "POST", credentials: "include", body: form });
  } catch {
    return { ok: false, status: 0, data: null };
  }
  let data: T | null = null;
  try {
    data = await res.json();
  } catch {
    // no/invalid JSON body — data stays null
  }
  return { ok: res.ok, status: res.status, data };
}

// hCaptcha requires a real, visible, user-solved widget — unlike reCAPTCHA
// v3 there is no invisible auto-minted token. Pages render the widget
// themselves and pass the resulting token into these calls.
export const HCAPTCHA_SITE_KEY = "8874894e-8ac6-4344-bb7e-67541fec27b8";

export const api = {
  async signup(email: string, password: string, captchaToken?: string) {
    return request("POST", "/auth/signup", { email, password, captchaToken });
  },
  async login(email: string, password: string, captchaToken?: string, rememberMe?: boolean) {
    return request("POST", "/auth/login", { email, password, captchaToken, rememberMe: !!rememberMe });
  },
  async logout() {
    return request("POST", "/auth/logout");
  },
  async me() {
    return request<{ user: { id: string; email: string; role: string } | null }>("GET", "/auth/me");
  },
  async forgotPassword(email: string, captchaToken?: string) {
    return request("POST", "/auth/forgot-password", { email, captchaToken });
  },
  async resetPassword(token: string, newPassword: string) {
    return request("POST", "/auth/reset-password", { token, newPassword });
  },
  async confirmSignup(pendingId: string, code: string) {
    return request("POST", "/auth/signup/confirm", { pendingId, code });
  },
  async resendSignupCode(pendingId: string) {
    return request("POST", "/auth/signup/resend", { pendingId });
  },
  async requestEmailChange(newEmail: string, currentPassword: string) {
    return request("POST", "/account/email/request-change", { newEmail, currentPassword });
  },
  async confirmEmailChange(code: string) {
    return request("POST", "/account/email/confirm-change", { code });
  },
  async requestPasswordChange(currentPassword: string, newPassword: string) {
    return request("POST", "/account/password/request-change", { currentPassword, newPassword });
  },
  async confirmPasswordChange(code: string) {
    return request("POST", "/account/password/confirm-change", { code });
  },
  async deleteAccount(currentPassword: string) {
    return request("DELETE", "/account", { currentPassword });
  },
  async submitContact(input: {
    name: string;
    email: string;
    subject: string;
    message?: string;
    files?: { fileKey: string; fileName: string }[];
    captchaToken?: string;
  }) {
    return request("POST", "/contact", input);
  },
  async uploadContactFile(file: File) {
    const form = new FormData();
    form.append("file", file, file.name);
    return requestForm<{ fileKey: string; fileName: string }>("/contact/upload", form);
  },
  async getMaterials() {
    return request("GET", "/materials");
  },
  async submitQuote(input: {
    file: File;
    material: string;
    colorId: string;
    quality: string;
    infillPct: number;
    quantity: number;
    scale?: number;
    clientWeightG?: number;
    clientEstimatedTimeMin?: number;
  }) {
    const form = new FormData();
    form.append("file", input.file, input.file.name);
    form.append("material", input.material);
    form.append("colorId", input.colorId);
    form.append("quality", input.quality);
    form.append("infillPct", String(input.infillPct));
    form.append("quantity", String(input.quantity));
    // Unit-mistake correction from the Unité/Échelle panel — a raw
    // multiplication factor, 1 = file as-is. Server re-derives the real
    // bounding box/volume from the transformed mesh directly, never trusted
    // as a price input on its own (see src/pages/api/quotes/index.ts).
    if (input.scale !== undefined) form.append("scale", String(input.scale));
    // Real client-side Kiri:Moto slice result, if one was computed (see
    // useQuoteWizard.ts's tryClientSlice) — the server independently
    // sanity-checks these before ever trusting them for pricing
    // (validateClaimedSlice in kiriSlicer.ts), so this is never a direct
    // price input either.
    if (input.clientWeightG !== undefined) form.append("clientWeightG", String(input.clientWeightG));
    if (input.clientEstimatedTimeMin !== undefined) form.append("clientEstimatedTimeMin", String(input.clientEstimatedTimeMin));
    return requestForm("/quotes", form);
  },
  async getQuote(id: string) {
    return request("GET", "/quotes/" + id);
  },
  quoteFileUrl(id: string) {
    return apiBase() + "/quotes/" + id + "/file";
  },
  async getDiscountTiers() {
    return request("GET", "/discount-tiers");
  },
  async getQuoteEnabled() {
    return request<{ quoteEnabled: boolean }>("GET", "/quote-enabled");
  },
  // ---- Admin ----
  async adminGetMaterials() {
    return request("GET", "/admin/materials");
  },
  async adminUpdateMaterialPrice(materialId: string, pricePerKgCents: number) {
    return request("PATCH", "/admin/materials/" + materialId, { pricePerKgCents });
  },
  async adminUpdateColorStock(materialId: string, colorId: string, inStock: boolean) {
    return request("PATCH", "/admin/materials/" + materialId + "/colors/" + colorId, { inStock });
  },
  async adminGetOrders(status?: string, q?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const qs = params.toString();
    return request("GET", "/admin/orders" + (qs ? "?" + qs : ""));
  },
  async adminUpdateOrderStatus(orderId: string, status: string) {
    return request("PATCH", "/admin/orders/" + orderId, { status });
  },
  async adminAcceptOrder(orderId: string) {
    return request("POST", "/admin/orders/" + orderId + "/accept");
  },
  async adminRejectOrder(orderId: string) {
    return request("POST", "/admin/orders/" + orderId + "/reject");
  },
  adminOrderFileUrl(orderId: string, itemId: string) {
    return apiBase() + "/admin/orders/" + orderId + "/items/" + itemId + "/file";
  },
  adminOrderLabelDownloadUrl(orderId: string) {
    return apiBase() + "/admin/orders/" + orderId + "/shipping-label/download";
  },
  adminOrderInvoiceDownloadUrl(orderId: string) {
    return apiBase() + "/admin/orders/" + orderId + "/invoice/download";
  },
  async adminDeleteOrderFile(orderId: string, itemId: string) {
    return request("DELETE", "/admin/orders/" + orderId + "/items/" + itemId + "/file");
  },
  async adminBuyShippingLabel(orderId: string) {
    return request("POST", "/admin/orders/" + orderId + "/shipping-label");
  },
  async adminCheckShippingLabel(orderId: string) {
    return request("GET", "/admin/orders/" + orderId + "/shipping-label");
  },
  async adminSetTrackingNumber(orderId: string, trackingNumber: string) {
    return request("PATCH", "/admin/orders/" + orderId, { trackingNumber });
  },
  async adminGetSettings() {
    return request("GET", "/admin/settings");
  },
  async adminUpdateSettings(patch: Record<string, unknown>) {
    return request("PATCH", "/admin/settings", patch);
  },
  // ---- Cart / checkout ----
  async getCart() {
    return request("GET", "/cart");
  },
  async addCartItem(quoteJobId: string, qty: number) {
    return request("POST", "/cart", { quoteJobId, qty });
  },
  async updateCartItem(id: string, qty: number) {
    return request("PATCH", "/cart/" + id, { qty });
  },
  async removeCartItem(id: string) {
    return request("DELETE", "/cart/" + id);
  },
  async getShippingRates(recipient: unknown) {
    return request("POST", "/shipping/rates", recipient);
  },
  async getBoxtalMapToken() {
    return request("GET", "/shipping/map-token");
  },
  async checkout(shipping: unknown) {
    return request("POST", "/checkout", { shipping });
  },
  async payOrder(orderId: string) {
    return request("POST", "/orders/" + orderId + "/pay");
  },
  async cancelOrder(orderId: string) {
    return request("DELETE", "/orders/" + orderId);
  },
  async getOrders() {
    return request("GET", "/orders");
  },
  async getInvoices() {
    return request("GET", "/invoices");
  },
  invoicePdfUrl(id: string) {
    return apiBase() + "/invoices/" + id + "/pdf";
  },
};
