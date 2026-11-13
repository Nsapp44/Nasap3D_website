// Centre d'erreurs admin (demande 65, lot 3). Contrat : docs/chantiers/centre-erreurs-admin_spec.md §4 et §6,
// maquette : docs/chantiers/centre-erreurs-admin_maquette.html.
// Tolère une API absente ou en échec : l'admin continue de fonctionner, le panneau affiche un message.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api, apiBase } from "../../lib/api-client";
import { AlertIcon, type AlertIconName } from "./alertIcons";

type ActionKind =
  | "retry_label"
  | "manual_label"
  | "retry_status"
  | "generate_invoice"
  | "open_order"
  | "open_stock"
  | "open_stripe"
  | "resolve";

interface AlertDTO {
  key: string;
  // Non défini par la spec : `PATCH /api/admin/alerts/[id]` a besoin d'un id, on prend `id` s'il existe, sinon `key`.
  id?: string;
  kind: string;
  severity: "critical" | "warning";
  title: string;
  message: string;
  detail?: string;
  orderId?: string;
  orderRef?: string;
  stripeRef?: string;
  at?: string;
  count?: number;
  source: "derived" | "stored";
  actions: ActionKind[];
}

interface Props {
  onOpenOrder: (ref: string) => void;
  onOpenTab: (tab: "shipping") => void;
}

const REFRESH_MS = 60_000;
const PANEL_WIDTH = 400;

const KIND_ICON: Record<string, AlertIconName> = {
  LABEL_REFUSED: "truck",
  BOXTAL_NOT_CONFIGURED: "truck",
  TRACKING_UNREACHABLE: "retry",
  PAYMENT_ANOMALY: "card",
  EMAIL_FAILED: "mail",
  ADDRESS_INCOMPLETE: "pin",
  RELAY_MISSING: "pin",
  BOX_STOCK_EMPTY: "package",
  INVOICE_MISSING: "file",
  WEIGHT_ONLY_QUOTE: "package",
};

async function alertRequest<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(apiBase() + path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data: T | null = null;
    try {
      data = await res.json();
    } catch {
      /* corps absent ou invalide */
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function plural(n: number, one: string, many: string) {
  return n > 1 ? many : one;
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diffMin = Math.floor((Date.now() - t) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `il y a ${Math.floor(diffMin / 60)} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const hhmm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === yesterday.toDateString()) return `hier, ${hhmm}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + `, ${hhmm}`;
}

function stripeUrl(a: AlertDTO): string | null {
  const m = /pi_[A-Za-z0-9]+/.exec(`${a.stripeRef ?? ""} ${a.key} ${a.detail ?? ""} ${a.message}`);
  return m ? `https://dashboard.stripe.com/payments/${m[0]}` : null;
}

function sortAlerts(list: AlertDTO[]): AlertDTO[] {
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      if (x.a.severity !== y.a.severity) return x.a.severity === "critical" ? -1 : 1;
      return x.i - y.i; // à gravité égale, on garde l'ordre du serveur (plus récent d'abord)
    })
    .map((x) => x.a);
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AlertCenter({ onOpenOrder, onOpenTab }: Props) {
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pos, setPos] = useState({ top: 62, left: 12 });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState("");
  const [announce, setAnnounce] = useState("");

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const prevCount = useRef<number | null>(null);

  const load = useCallback(async () => {
    const res = await alertRequest<{ alerts?: AlertDTO[] }>("GET", "/admin/alerts");
    if (res.ok && res.data && Array.isArray(res.data.alerts)) {
      setAlerts(sortAlerts(res.data.alerts));
      setLoadFailed(false);
    } else {
      // Réponse en échec : on garde la dernière liste connue, on le signale seulement dans le panneau.
      setLoadFailed(true);
    }
    setLoaded(true);
  }, []);

  // Chargement initial + toutes les 60 s si l'onglet est visible.
  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Mobile = tiroir.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const total = alerts.length;

  // Annonce du compteur seulement quand il change (pas au premier chargement).
  useEffect(() => {
    if (!loaded) return;
    if (prevCount.current !== null && prevCount.current !== total) {
      setAnnounce(total === 0 ? "Plus aucune erreur à traiter" : `${total} ${plural(total, "erreur", "erreurs")} à traiter`);
    }
    prevCount.current = total;
  }, [total, loaded]);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12));
    setPos({ top: Math.round(r.bottom + 10), left: Math.round(left) });
  }, []);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setManualFor(null);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  function toggle() {
    if (open) {
      close();
      return;
    }
    place();
    setOpen(true);
    load();
  }

  // Focus sur le titre à l'ouverture ; repositionnement ; verrou de défilement du fond en mode tiroir.
  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const prevOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isMobile, place]);

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Tab" && isMobile && panelRef.current) {
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === titleRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function setResult(key: string, ok: boolean, text: string) {
    setResults((r) => ({ ...r, [key]: { ok, text } }));
  }

  function openOrder(ref: string) {
    close(false);
    onOpenOrder(ref);
  }

  async function run(a: AlertDTO, action: ActionKind) {
    setBusyKey(a.key + action);
    setResults((r) => {
      const next = { ...r };
      delete next[a.key];
      return next;
    });
    let res: { ok: boolean; status: number; data: unknown } | null = null;
    let okText = "Fait.";
    let failText = "L'action a échoué.";
    if (action === "retry_label" && a.orderId) {
      res = await api.adminBuyShippingLabel(a.orderId);
      okText = "Étiquette demandée à Boxtal.";
    } else if (action === "retry_status" && a.orderId) {
      res = await api.adminCheckShippingLabel(a.orderId);
      okText = "Suivi vérifié.";
    } else if (action === "generate_invoice" && a.orderId) {
      res = await api.adminGenerateOrderInvoice(a.orderId);
      okText = "Facture générée.";
    } else if (action === "resolve") {
      res = await alertRequest("PATCH", "/admin/alerts/" + encodeURIComponent(a.id ?? a.key), { action: "resolve" });
      okText = "Marquée comme traitée.";
    }
    setBusyKey(null);
    if (!res) return;
    if (res.ok) {
      setResult(a.key, true, okText);
    } else {
      const d = res.data as { reason?: unknown; error?: unknown } | null;
      const reason = typeof d?.reason === "string" ? d.reason : "";
      failText = reason ? `${failText} Raison : ${reason}` : res.status === 0 ? "Le serveur ne répond pas. Réessayez dans un instant." : failText;
      setResult(a.key, false, failText);
    }
    load();
  }

  async function saveManual(a: AlertDTO) {
    const value = trackingDraft.trim();
    if (!a.orderId || !value) {
      setResult(a.key, false, "Saisissez le numéro de suivi.");
      return;
    }
    setBusyKey(a.key + "manual_label");
    const res = await alertRequest<{ reason?: string; error?: string }>("POST", `/admin/orders/${a.orderId}/manual-label`, { trackingNumber: value });
    setBusyKey(null);
    if (res.ok) {
      setManualFor(null);
      setTrackingDraft("");
      setResult(a.key, true, "Étiquette enregistrée comme faite à la main.");
      load();
    } else {
      const why =
        res.status === 409
          ? "Cette commande ne peut plus recevoir d'étiquette manuelle (déjà faite ou statut inadapté)."
          : res.status === 0
            ? "Le serveur ne répond pas. Réessayez dans un instant."
            : "L'enregistrement a échoué.";
      setResult(a.key, false, why);
    }
  }

  function renderMessage(text: string) {
    const parts = text.split(/(N3D-[A-Za-z0-9]+)/g);
    return parts.map((p, i) =>
      /^N3D-[A-Za-z0-9]+$/.test(p) ? (
        <button key={i} type="button" className="ac-ref" onClick={() => openOrder(p)}>
          {p}
        </button>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    );
  }

  function renderActions(a: AlertDTO) {
    const buttons: React.ReactNode[] = [];
    for (const act of a.actions ?? []) {
      const busy = busyKey === a.key + act;
      switch (act) {
        case "retry_label":
        case "retry_status":
          if (!a.orderId) break;
          buttons.push(
            <button key={act} type="button" className={`ac-btn${act === "retry_label" ? " primary" : ""}`} disabled={!!busyKey} onClick={() => run(a, act)}>
              <AlertIcon name="retry" />
              {busy ? "En cours…" : "Réessayer"}
            </button>,
          );
          break;
        case "manual_label":
          if (!a.orderId) break;
          buttons.push(
            <button
              key={act}
              type="button"
              className="ac-btn"
              aria-expanded={manualFor === a.key}
              aria-controls={`ac-manual-${a.key}`}
              onClick={() => {
                setTrackingDraft("");
                setManualFor(manualFor === a.key ? null : a.key);
              }}
            >
              Étiquette faite à la main
            </button>,
          );
          break;
        case "generate_invoice":
          if (!a.orderId) break;
          buttons.push(
            <button key={act} type="button" className="ac-btn" disabled={!!busyKey} onClick={() => run(a, act)}>
              {busy ? "En cours…" : "Générer la facture"}
            </button>,
          );
          break;
        case "open_order":
          if (!a.orderRef) break;
          buttons.push(
            <button key={act} type="button" className="ac-btn muted" onClick={() => openOrder(a.orderRef as string)}>
              Voir la commande
            </button>,
          );
          break;
        case "open_stock":
          buttons.push(
            <button
              key={act}
              type="button"
              className="ac-btn"
              onClick={() => {
                close(false);
                onOpenTab("shipping");
              }}
            >
              Voir le stock
            </button>,
          );
          break;
        case "open_stripe": {
          const url = stripeUrl(a);
          if (!url) break;
          buttons.push(
            <a key={act} className="ac-btn" href={url} target="_blank" rel="noopener noreferrer">
              Ouvrir dans Stripe
            </a>,
          );
          break;
        }
        case "resolve":
          buttons.push(
            <button key={act} type="button" className="ac-btn muted" disabled={!!busyKey} onClick={() => run(a, act)}>
              {busy ? "En cours…" : "Traité"}
            </button>,
          );
          break;
      }
    }
    return buttons;
  }

  const hasAny = total > 0;
  const label = loadFailed && !hasAny ? "Erreurs : non chargées" : total === 0 ? "Erreurs : aucune" : `Erreurs : ${total} à traiter`;
  const pill = total > 9 ? "9+" : String(total);
  const countLine =
    total === 0
      ? "Aucune erreur"
      : `${total} ${plural(total, "erreur", "erreurs")}${criticalCount > 0 ? ` · ${criticalCount} ${plural(criticalCount, "critique", "critiques")}` : ""}`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`ac-btn-icon${criticalCount > 0 ? " has-critical" : ""}${open ? " open" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls="alert-panel"
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <AlertIcon name="alert" />
        {total > 0 && (
          <span className="ac-pill" aria-hidden="true">
            {pill}
          </span>
        )}
      </button>
      <span className="ac-sr" aria-live="polite">
        {announce}
      </span>

      {open && (
        <>
          <div className={`ac-scrim${isMobile ? " visible" : ""}`} onClick={() => close()} aria-hidden="true" />
          <div
            id="alert-panel"
            ref={panelRef}
            className={`ac-panel${isMobile ? " drawer" : ""}`}
            role="dialog"
            aria-labelledby="alert-panel-title"
            style={{ ["--ac-top" as string]: `${pos.top}px`, ["--ac-left" as string]: `${pos.left}px` }}
            onKeyDown={onPanelKeyDown}
          >
            {isMobile && <div className="ac-handle" aria-hidden="true" />}
            <div className="ac-head">
              <div>
                <h2 className="ac-title" id="alert-panel-title" tabIndex={-1} ref={titleRef}>
                  Erreurs à traiter
                </h2>
                <div className="ac-count">{countLine}</div>
              </div>
              <button type="button" className="ac-icon-btn" aria-label="Fermer" onClick={() => close()}>
                <AlertIcon name="x" />
              </button>
            </div>

            <div className="ac-list">
              {loadFailed && (
                <div className="ac-notice" role="status">
                  Impossible de charger les erreurs pour le moment.{" "}
                  <button type="button" className="ac-link" onClick={() => load()}>
                    Réessayer
                  </button>
                </div>
              )}
              {!hasAny && !loadFailed && <div className="ac-empty">Aucune erreur à traiter. Tout est en ordre.</div>}
              {alerts.map((a) => {
                const result = results[a.key];
                const when = relativeTime(a.at);
                return (
                  <article key={a.key} className={`ac-card${a.severity === "warning" ? " warn" : ""}`}>
                    <div className="ac-card-top">
                      <span className="ac-type-ic">
                        <AlertIcon name={KIND_ICON[a.kind] ?? "alert"} />
                      </span>
                      <div className="ac-card-body">
                        <div className="ac-card-title">
                          <span>
                            {a.title}
                            {a.count && a.count > 1 ? <span className="ac-times"> ×{a.count}</span> : null}
                          </span>
                          {when && <span className="ac-when ac-when-top">{when}</span>}
                        </div>
                        <div className="ac-card-text">{renderMessage(a.message)}</div>
                        {a.detail && <div className="ac-detail">{a.detail}</div>}
                        {when && <div className="ac-when ac-when-below">{when}</div>}
                      </div>
                    </div>
                    <div className="ac-actions">{renderActions(a)}</div>
                    {manualFor === a.key && (
                      <div className="ac-manual" id={`ac-manual-${a.key}`}>
                        <label htmlFor={`ac-trk-${a.key}`}>N° de suivi (étiquette créée sur boxtal.com)</label>
                        <div className="ac-manual-row">
                          <input
                            id={`ac-trk-${a.key}`}
                            className="ac-input"
                            type="text"
                            value={trackingDraft}
                            maxLength={60}
                            autoComplete="off"
                            onChange={(e) => setTrackingDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveManual(a);
                            }}
                          />
                          <button type="button" className="ac-btn primary" disabled={!!busyKey} onClick={() => saveManual(a)}>
                            {busyKey === a.key + "manual_label" ? "…" : "Enregistrer"}
                          </button>
                        </div>
                        <div className="ac-manual-hint">La commande sera marquée « étiquette faite à la main » ; le bouton « Créer l'étiquette » disparaît.</div>
                      </div>
                    )}
                    {result && (
                      <div className={`ac-result${result.ok ? " ok" : " ko"}`} role="status">
                        {result.text}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="ac-foot">Les erreurs liées à l'état d'une commande disparaissent seules une fois réglées.</div>
          </div>
        </>
      )}

      <style>{`
        .ac-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .ac-btn-icon { position: relative; flex: none; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; border: 1px solid transparent; background: transparent; color: rgba(255,255,255,.45); cursor: pointer; padding: 0; transition: background .2s ease, color .2s ease; }
        .ac-btn-icon::after { content: ""; position: absolute; inset: -2px; }
        .ac-btn-icon:hover { background: rgba(255,255,255,.06); color: #f3f1ec; }
        .ac-btn-icon:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; }
        .ac-btn-icon.has-critical { color: #ff5a3c; }
        .ac-btn-icon.open { background: rgba(255,90,60,.12); border-color: rgba(255,90,60,.35); }
        .ac-btn-icon svg { width: 20px; height: 20px; }
        .ac-pill { position: absolute; top: -3px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; background: #ff5a3c; color: #161514; font: 700 10px/18px 'Inter',sans-serif; text-align: center; box-shadow: 0 0 0 2px #161514; }

        .ac-scrim { position: fixed; inset: 0; background: transparent; z-index: 999; }
        .ac-scrim.visible { background: rgba(0,0,0,.55); }
        .ac-panel { position: fixed; top: var(--ac-top); left: var(--ac-left); width: min(${PANEL_WIDTH}px, calc(100vw - 24px)); max-height: min(560px, calc(100vh - var(--ac-top) - 16px)); box-sizing: border-box; display: flex; flex-direction: column; background: #1a1917; color: #f3f1ec; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; box-shadow: 0 18px 50px rgba(0,0,0,.55); z-index: 1000; animation: ac-enter .5s ease both; color-scheme: dark; text-align: left; }
        .ac-panel * { box-sizing: border-box; }
        @keyframes ac-enter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .ac-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .ac-title { font: 700 15px 'Space Grotesk',sans-serif; color: #f3f1ec; margin: 0; outline: none; }
        .ac-count { font: 500 11px 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-top: 2px; }
        .ac-icon-btn { flex: none; width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: rgba(255,255,255,.6); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
        .ac-icon-btn:hover { background: rgba(255,255,255,.06); color: #f3f1ec; }
        .ac-icon-btn:focus-visible, .ac-btn:focus-visible, .ac-ref:focus-visible, .ac-link:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; }
        .ac-icon-btn svg { width: 18px; height: 18px; }
        .ac-list { overflow-y: auto; overflow-x: hidden; padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 0; overscroll-behavior: contain; }
        .ac-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #201d1b; padding: 12px 12px 12px 14px; position: relative; flex: none; }
        .ac-card::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: #ff5a3c; }
        .ac-card.warn::before { background: #f0b35a; }
        .ac-card-top { display: flex; gap: 10px; align-items: flex-start; }
        .ac-type-ic { flex: none; width: 28px; height: 28px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,90,60,.14); color: #ff5a3c; }
        .ac-card.warn .ac-type-ic { background: rgba(240,179,90,.14); color: #f0b35a; }
        .ac-type-ic svg { width: 16px; height: 16px; }
        .ac-card-body { flex: 1; min-width: 0; }
        .ac-card-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; display: flex; justify-content: space-between; gap: 8px; }
        .ac-times { font-weight: 500; color: rgba(255,255,255,.5); }
        .ac-when { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.55); white-space: nowrap; }
        .ac-when-below { display: none; margin-top: 2px; }
        .ac-card-text { font: 400 12px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.75); margin-top: 2px; overflow-wrap: anywhere; }
        .ac-ref { display: inline; padding: 0; border: none; background: transparent; font: 600 12px 'Inter',sans-serif; color: #f3f1ec; text-decoration: underline; text-decoration-color: rgba(255,90,60,.6); text-underline-offset: 2px; cursor: pointer; }
        .ac-ref:hover { color: #ff5a3c; }
        .ac-detail { font: 400 11px/1.45 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-top: 4px; overflow-wrap: anywhere; }
        .ac-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-left: 38px; }
        .ac-actions:empty { display: none; }
        .ac-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 0 11px; border-radius: 7px; border: 1px solid rgba(255,255,255,.18); background: transparent; color: #f3f1ec; font: 600 11.5px 'Inter',sans-serif; cursor: pointer; text-decoration: none; }
        .ac-btn:hover { border-color: #ff5a3c; color: #ff5a3c; }
        .ac-btn.primary { background: #ff5a3c; border-color: #ff5a3c; color: #161514; }
        .ac-btn.primary:hover { color: #161514; filter: brightness(1.08); }
        .ac-btn.muted { color: rgba(255,255,255,.6); border-color: rgba(255,255,255,.1); }
        .ac-btn.muted:hover { color: #ff5a3c; border-color: #ff5a3c; }
        .ac-btn:disabled { opacity: .55; cursor: wait; }
        .ac-btn svg { width: 14px; height: 14px; }
        .ac-manual { margin: 10px 0 0 38px; padding: 10px; border-radius: 8px; background: #161514; border: 1px solid rgba(255,255,255,.1); }
        .ac-manual label { display: block; font: 500 11px 'Inter',sans-serif; color: rgba(255,255,255,.6); margin-bottom: 6px; }
        .ac-manual-row { display: flex; gap: 6px; }
        .ac-input { flex: 1; min-width: 0; height: 32px; border: 1px solid rgba(255,255,255,.15); border-radius: 7px; background: #1a1917; color: #e8e6e1; padding: 0 10px; font: 12px 'Inter',sans-serif; }
        .ac-input:focus { outline: 2px solid #ff5a3c; outline-offset: 1px; }
        .ac-manual-hint { font: 400 10.5px/1.4 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-top: 6px; }
        .ac-result { margin: 8px 0 0 38px; font: 500 11px/1.4 'Inter',sans-serif; }
        .ac-result.ok { color: #8fd19e; }
        .ac-result.ko { color: #ff8a70; }
        .ac-notice, .ac-empty { padding: 14px; border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; font: 500 12px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.65); text-align: center; }
        .ac-link { padding: 0; border: none; background: transparent; color: #ff8a70; font: 600 12px 'Inter',sans-serif; text-decoration: underline; cursor: pointer; }
        .ac-foot { padding: 10px 16px; border-top: 1px solid rgba(255,255,255,.08); font: 400 11px/1.4 'Inter',sans-serif; color: rgba(255,255,255,.55); }

        @media (max-width: 560px) {
          .ac-btn-icon::after { inset: -2px; }
          .ac-panel.drawer { top: auto; left: 0; right: 0; bottom: 0; width: auto; height: 85vh; max-height: none; border-radius: 16px 16px 0 0; border-left: none; border-right: none; border-bottom: none; padding-bottom: env(safe-area-inset-bottom, 0); }
          .ac-handle { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.25); margin: 8px auto 4px; flex: none; }
          .ac-panel.drawer .ac-head { padding-top: 6px; }
          .ac-panel.drawer .ac-btn { min-height: 40px; padding: 0 13px; }
          .ac-panel.drawer .ac-icon-btn { width: 40px; height: 40px; }
          .ac-panel.drawer .ac-ref, .ac-panel.drawer .ac-link { min-height: 24px; }
          .ac-panel.drawer .ac-actions { padding-left: 0; }
          .ac-panel.drawer .ac-manual, .ac-panel.drawer .ac-result { margin-left: 0; }
          .ac-panel.drawer .ac-input { height: 40px; font-size: 16px; }
          .ac-panel.drawer .ac-when-top { display: none; }
          .ac-panel.drawer .ac-when-below { display: block; }
          .ac-panel.drawer .ac-manual-row { flex-wrap: wrap; }
          .ac-panel.drawer .ac-manual-row .ac-input { flex: 1 1 140px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ac-panel { animation: none; }
          .ac-btn-icon { transition: none; }
        }
      `}</style>
    </>
  );
}
