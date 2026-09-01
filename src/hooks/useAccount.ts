import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api-client";

export interface AccountOrderItem {
  nameSnapshot: string;
  materialSnapshot: string;
  qty: number;
}
export interface AccountOrder {
  id: string;
  ref: string;
  status: string;
  totalCents: number;
  createdAt: string;
  items: AccountOrderItem[];
  shippingMode: string | null;
  trackingNumber: string | null;
}
export interface AccountInvoice {
  id: string;
  ref: string;
  orderRef: string;
  issuedAt: string;
  amountCents: number;
}

type View = "dashboard" | "settings";
export type VerifyPurpose = "signup" | "email" | "password";

const MAX_CODE_RESENDS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']).{8,}$/;

// A missing/unparseable expiresAt (dropped field, network hiccup) must never
// leave verifyExpiresAt holding NaN — that propagates straight into the
// countdown's Math.floor/% arithmetic and renders as "NaN:NaN" instead of
// the intended "Code expiré." fallback.
function parseExpiresAt(value: string | undefined): number {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now() - 1;
}

function errorMessage(data: unknown): string {
  const code = (data as { error?: string } | null)?.error;
  const messages: Record<string, string> = {
    invalid_credentials: "Aucun compte trouvé, vérifiez le mail/mot de passe.",
    email_taken: "Un compte existe déjà avec cette adresse e-mail.",
    weak_password: "Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 caractère spécial.",
    invalid_email: "Format d'email invalide.",
    wrong_password: "Le mot de passe actuel est incorrect.",
    captcha_failed: "Vérification anti-robot échouée, merci de cocher la case et réessayer.",
    invalid_or_expired_token: "Ce lien de réinitialisation est invalide ou a expiré.",
    network_error: "Impossible de contacter le serveur, réessayez dans un instant.",
    mail_send_failed: "L'email n'a pas pu être envoyé, merci de réessayer dans un instant.",
  };
  return (code && messages[code]) || "Une erreur est survenue, merci de réessayer.";
}

function verifyErrorMessage(data: unknown): string {
  const code = (data as { error?: string } | null)?.error;
  const messages: Record<string, string> = {
    wrong_code: "Code incorrect.",
    no_pending_code: 'Aucun code en attente — cliquez sur "Renvoyer le code".',
    too_many_attempts: 'Trop de tentatives — cliquez sur "Renvoyer le code" pour en obtenir un nouveau.',
    email_taken: "Cette adresse e-mail est déjà utilisée par un autre compte.",
  };
  return (code && messages[code]) || "Une erreur est survenue.";
}

// Ported from Account.dc.html's Component — the dashboard/settings/orders
// half of it (auth form + its hCaptcha stay local to AuthPanel, same
// self-contained pattern as ContactForm, since React's normal mount/unmount
// already gives every fresh AuthPanel mount a fresh captcha widget for
// free — the original needed a whole componentDidUpdate workaround for this
// exact problem because its single persistent component tree never actually
// unmounted the login form, only hid it).
export function useAccount() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [checkoutNotice, setCheckoutNotice] = useState<"paid" | "canceled" | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [invoices, setInvoices] = useState<AccountInvoice[]>([]);

  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const [popupConfirm, setPopupConfirm] = useState<"delete" | "verify-code" | null>(null);

  const [verifyPurpose, setVerifyPurpose] = useState<VerifyPurpose | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyMessageOk, setVerifyMessageOk] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyExpiresAt, setVerifyExpiresAt] = useState<number | null>(null);
  const [verifyResendCount, setVerifyResendCount] = useState(0);
  const [pendingSignupId, setPendingSignupId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // Which order's "Payer avec Stripe" button is mid-redirect, if any — a
  // plain boolean would light up every pay button at once when a customer
  // has several orders awaiting payment.
  const [payBusyId, setPayBusyId] = useState<string | null>(null);
  // Holds the id of the order the popup targets, not just whether it's
  // open — needed now that a customer can have several cancellable orders
  // at once (see activeOrders below), each with its own "Annuler" button.
  const [cancelOrderPopup, setCancelOrderPopup] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  // Kept here (not local to SettingsPanel) because resendCode() below needs
  // to re-submit the same email/password fields the original request used —
  // matches the original's single-component-state design, and avoids
  // SettingsPanel having to reach back up into the verify-code flow.
  const [newEmail, setNewEmail] = useState("");
  const [emailCurPwd, setEmailCurPwd] = useState("");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [deletePwd, setDeletePwd] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);

  const verifyTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopVerifyCountdown = useCallback(() => {
    if (verifyTickRef.current) clearInterval(verifyTickRef.current);
    verifyTickRef.current = null;
  }, []);
  const startVerifyCountdown = useCallback(() => {
    stopVerifyCountdown();
    verifyTickRef.current = setInterval(() => forceTick((n) => n + 1), 1000);
  }, [stopVerifyCountdown]);

  const loadOrdersAndInvoices = useCallback(async () => {
    const [ordersRes, invoicesRes] = await Promise.all([api.getOrders(), api.getInvoices()]);
    setOrders(ordersRes.ok && ordersRes.data ? (ordersRes.data as { orders: AccountOrder[] }).orders : []);
    setInvoices(invoicesRes.ok && invoicesRes.data ? (invoicesRes.data as { invoices: AccountInvoice[] }).invoices : []);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");
    const requestedView = params.get("view") === "settings" ? "settings" : null;
    // Landed here from /panier ("Passer la commande pour expertise") or back
    // from Stripe (see routes/checkout.ts success_url/cancel_url).
    if (params.get("paid") === "1") setCheckoutNotice("paid");
    else if (params.get("canceled") === "1") setCheckoutNotice("canceled");
    if (params.get("paid") || params.get("canceled")) window.history.replaceState({}, "", "/compte");

    if (token) {
      setResetToken(token);
      setSessionChecked(true);
      return;
    }
    api.me().then((res) => {
      const user = res.ok ? (res.data as { user: { email: string; customerNo: string } | null } | null)?.user : null;
      if (user) {
        setLoggedIn(true);
        setAuthEmail(user.email);
        setCustomerNo(user.customerNo);
        setView(requestedView || "dashboard");
        loadOrdersAndInvoices();
      }
      setSessionChecked(true);
    });
    return () => stopVerifyCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The cart's "Se connecter" button links here with ?next=panier (see
  // CartPage.tsx) when a guest needs to log in specifically to place an
  // order — sending them to the account dashboard afterward instead of
  // back to the cart they came from would mean an extra manual step to
  // get back to what they were actually doing.
  function redirectBackToCartIfNeeded(): boolean {
    if (new URLSearchParams(window.location.search).get("next") !== "panier") return false;
    window.location.href = "/panier";
    return true;
  }

  function onLoginSuccess(user: { email: string; customerNo: string }) {
    setLoggedIn(true);
    setAuthEmail(user.email);
    setCustomerNo(user.customerNo);
    if (redirectBackToCartIfNeeded()) return;
    setView("dashboard");
    loadOrdersAndInvoices();
  }

  function onSignupCodeSent(id: string, email: string, expiresAt: string) {
    setPendingSignupId(id);
    setPopupMessage(`Un code à 6 chiffres a été envoyé à ${email}. Saisissez-le pour créer votre compte.`);
    setPopupConfirm("verify-code");
    setVerifyPurpose("signup");
    setVerifyCode("");
    setVerifyMessage(null);
    setVerifyExpiresAt(parseExpiresAt(expiresAt));
    setVerifyResendCount(0);
    startVerifyCountdown();
  }

  function showError(data: unknown) {
    setPopupMessage(errorMessage(data));
  }

  async function submitVerify() {
    if (verifyBusy || verifyCode.trim().length !== 6) return;
    setVerifyBusy(true);
    setVerifyMessage(null);

    if (verifyPurpose === "signup") {
      const res = await api.confirmSignup(pendingSignupId!, verifyCode.trim());
      setVerifyBusy(false);
      const user = res.ok ? (res.data as { user: { email: string; customerNo: string; role: string } } | null)?.user : null;
      if (user) {
        if (user.role === "ADMIN") {
          window.location.href = "/admin";
          return;
        }
        stopVerifyCountdown();
        setLoggedIn(true);
        setAuthEmail(user.email);
        setCustomerNo(user.customerNo);
        setPendingSignupId(null);
        setVerifyExpiresAt(null);
        setVerifyResendCount(0);
        setPopupConfirm(null);
        setVerifyPurpose(null);
        setVerifyCode("");
        if (redirectBackToCartIfNeeded()) return;
        setView("dashboard");
        setPopupMessage("Compte créé avec succès.");
        return;
      }
      setVerifyMessage(verifyErrorMessage(res.data));
      setVerifyMessageOk(false);
      return;
    }

    if (verifyPurpose === "email") {
      const res = await api.confirmEmailChange(verifyCode.trim());
      setVerifyBusy(false);
      const user = res.ok ? (res.data as { user: { email: string } } | null)?.user : null;
      if (user) {
        stopVerifyCountdown();
        setAuthEmail(user.email);
        setVerifyExpiresAt(null);
        setVerifyResendCount(0);
        setPopupMessage("Votre adresse e-mail a été mise à jour : " + user.email);
        setPopupConfirm(null);
        setVerifyPurpose(null);
        setVerifyCode("");
        return;
      }
      setVerifyMessage(verifyErrorMessage(res.data));
      setVerifyMessageOk(false);
      return;
    }

    if (verifyPurpose === "password") {
      const res = await api.confirmPasswordChange(verifyCode.trim());
      setVerifyBusy(false);
      if (res.ok && res.data && (res.data as { ok?: boolean }).ok) {
        stopVerifyCountdown();
        setVerifyExpiresAt(null);
        setVerifyResendCount(0);
        setPopupMessage("Votre mot de passe a été modifié avec succès.");
        setPopupConfirm(null);
        setVerifyPurpose(null);
        setVerifyCode("");
        return;
      }
      setVerifyMessage(verifyErrorMessage(res.data));
      setVerifyMessageOk(false);
    }
  }

  // Shared by AuthPanel's signup resend (pendingId, no local fields needed)
  // and the email/password-change resend below (re-submits newEmail/curPwd/
  // newPwd, kept in this same hook — see the comment on those fields above).
  async function resendCode() {
    if (verifyExpiresAt && Date.now() < verifyExpiresAt) return;
    // 3 renvois consécutifs et on arrête de mailer — probablement une
    // adresse qui ne reçoit rien (typo, spam...).
    if (verifyResendCount >= MAX_CODE_RESENDS) {
      stopVerifyCountdown();
      setPopupMessage("Trop de tentatives — recommencez depuis le début.");
      setPopupConfirm(null);
      setVerifyPurpose(null);
      setVerifyCode("");
      setVerifyMessage(null);
      setPendingSignupId(null);
      setVerifyExpiresAt(null);
      setVerifyResendCount(0);
      return;
    }
    setVerifyMessage(null);
    let res;
    if (verifyPurpose === "email") res = await api.requestEmailChange(newEmail, emailCurPwd);
    else if (verifyPurpose === "password") res = await api.requestPasswordChange(curPwd, newPwd);
    else res = await api.resendSignupCode(pendingSignupId!);
    if (res.ok) {
      const data = res.data as { expiresAt: string };
      setVerifyMessage("Un nouveau code a été envoyé.");
      setVerifyMessageOk(true);
      setVerifyExpiresAt(parseExpiresAt(data.expiresAt));
      setVerifyResendCount((n) => n + 1);
      startVerifyCountdown();
    } else {
      const errKey = (res.data as { error?: string } | null)?.error;
      setVerifyMessage(errKey === "too_soon" ? "Patientez encore un peu avant de redemander un code." : "Une erreur est survenue.");
      setVerifyMessageOk(false);
    }
  }

  function closePopup() {
    // Cancelling a pending signup just drops pendingSignupId — no account
    // was ever created, only an unused VerificationCode row that expires on
    // its own after 3 minutes.
    stopVerifyCountdown();
    setPopupMessage(null);
    setPopupConfirm(null);
    setVerifyPurpose(null);
    setVerifyCode("");
    setVerifyMessage(null);
    setPendingSignupId(null);
    setVerifyExpiresAt(null);
    setVerifyResendCount(0);
  }

  async function confirmPopup() {
    if (popupConfirm === "delete") {
      const res = await api.deleteAccount(deletePwd);
      if (!res.ok) {
        setPopupMessage(errorMessage(res.data));
        setPopupConfirm(null);
        setDeletePwd("");
        return;
      }
      setLoggedIn(false);
      setView("dashboard");
      setAuthEmail("");
      setCustomerNo("");
      setDeletePwd("");
      setPopupMessage(null);
      setPopupConfirm(null);
      return;
    }
    setPopupMessage(null);
    setPopupConfirm(null);
  }

  async function requestEmailChange() {
    if (settingsBusy) return;
    if (!EMAIL_RE.test(newEmail)) {
      setPopupMessage("Merci d'entrer une adresse e-mail valide.");
      return;
    }
    if (!emailCurPwd) {
      setPopupMessage("Merci de confirmer avec votre mot de passe actuel.");
      return;
    }
    setSettingsBusy(true);
    const res = await api.requestEmailChange(newEmail, emailCurPwd);
    setSettingsBusy(false);
    if (!res.ok) {
      setPopupMessage(errorMessage(res.data));
      return;
    }
    const data = res.data as { expiresAt: string };
    setPopupMessage(`Un code à 6 chiffres a été envoyé à ${newEmail}. Saisissez-le pour confirmer ce changement.`);
    setPopupConfirm("verify-code");
    setVerifyPurpose("email");
    setVerifyCode("");
    setVerifyMessage(null);
    setVerifyExpiresAt(parseExpiresAt(data.expiresAt));
    setVerifyResendCount(0);
    startVerifyCountdown();
  }

  async function requestPasswordChange() {
    if (settingsBusy) return;
    if (!PASSWORD_RE.test(newPwd)) {
      setPopupMessage("Le nouveau mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 caractère spécial.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPopupMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSettingsBusy(true);
    const res = await api.requestPasswordChange(curPwd, newPwd);
    setSettingsBusy(false);
    if (!res.ok) {
      setPopupMessage(errorMessage(res.data));
      return;
    }
    const data = res.data as { expiresAt: string };
    setPopupMessage(`Un code à 6 chiffres a été envoyé à ${authEmail}. Saisissez-le pour confirmer ce changement.`);
    setPopupConfirm("verify-code");
    setVerifyPurpose("password");
    setVerifyCode("");
    setVerifyMessage(null);
    setVerifyExpiresAt(parseExpiresAt(data.expiresAt));
    setVerifyResendCount(0);
    startVerifyCountdown();
  }

  function requestDelete() {
    if (!deletePwd) {
      setPopupMessage("Entrez votre mot de passe actuel pour confirmer la suppression.");
      return;
    }
    setPopupMessage("Supprimer définitivement votre compte ? Vos commandes et factures ne seront plus accessibles. Cette action est irréversible.");
    setPopupConfirm("delete");
  }

  async function logout() {
    await api.logout();
    setLoggedIn(false);
    setView("dashboard");
    setAuthEmail("");
    setCustomerNo("");
  }

  function goSettings() {
    setView("settings");
  }
  function goDashboard() {
    setView("dashboard");
    setNewEmail("");
    setEmailCurPwd("");
    setCurPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setDeletePwd("");
  }

  // Every order still worth showing an action card for — not just the
  // single most-recent one. A customer can have several orders awaiting
  // payment at once (e.g. two separate expertise quotes accepted around
  // the same time) and each needs its own visible "Payer avec Stripe".
  const activeOrders = orders.filter((o) => o.status !== "DELIVERED");

  async function payOrder(orderId: string) {
    if (payBusyId) return;
    setPayBusyId(orderId);
    const res = await api.payOrder(orderId);
    const data = res.data as { url?: string } | null;
    if (!res.ok || !data?.url) {
      setPayBusyId(null);
      window.alert("Le paiement n'a pas pu démarrer, réessayez.");
      return;
    }
    window.location.href = data.url;
  }
  async function confirmCancelOrder() {
    if (cancelBusy || !cancelOrderPopup) return;
    setCancelBusy(true);
    const res = await api.cancelOrder(cancelOrderPopup);
    setCancelBusy(false);
    setCancelOrderPopup(null);
    if (!res.ok) {
      window.alert("La commande n'a pas pu être annulée, réessayez.");
      return;
    }
    loadOrdersAndInvoices();
  }

  const remainingMs = verifyExpiresAt ? verifyExpiresAt - Date.now() : 0;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const codeExpired = !!verifyExpiresAt && remainingMs <= 0;
  const canResendCode = !verifyExpiresAt || codeExpired;

  return {
    sessionChecked,
    loggedIn,
    authEmail,
    customerNo,
    view,
    checkoutNotice,
    resetToken,
    setResetToken,
    orders,
    invoices,
    activeOrders,
    popupMessage,
    popupConfirm,
    setPopupMessage,
    onLoginSuccess,
    onSignupCodeSent,
    showError,
    verifyPurpose,
    verifyCode,
    setVerifyCode,
    verifyMessage,
    verifyMessageOk,
    verifyBusy,
    canResendCode,
    codeExpired,
    remainingSec,
    submitVerify,
    resendCode,
    closePopup,
    confirmPopup,
    requestDelete,
    logout,
    goSettings,
    goDashboard,
    payBusyId,
    payOrder,
    cancelOrderPopup,
    setCancelOrderPopup,
    cancelBusy,
    confirmCancelOrder,
    newEmail,
    setNewEmail,
    emailCurPwd,
    setEmailCurPwd,
    curPwd,
    setCurPwd,
    newPwd,
    setNewPwd,
    confirmPwd,
    setConfirmPwd,
    deletePwd,
    setDeletePwd,
    settingsBusy,
    requestEmailChange,
    requestPasswordChange,
  };
}
