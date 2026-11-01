import { useCallback, useEffect, useState } from "react";
import { apiBase } from "../../lib/api-client";

interface Entry {
  id: string;
  email: string;
  createdAt: string;
}

// Pas de méthode générique dans api-client : fetch direct, même base et mêmes cookies.
async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
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
      // pas de corps JSON
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export default function ShopWaitlistTab() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [count, setCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await call<{ count: number; entries: Entry[] }>("GET", "/admin/shop-waitlist");
    if (res.ok && res.data) {
      setEntries(res.data.entries);
      setCount(res.data.count);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(entry: Entry) {
    if (busy || !window.confirm(`Retirer ${entry.email} de la liste d'attente ?`)) return;
    setBusy(true);
    setMessage(null);
    const res = await call("DELETE", `/admin/shop-waitlist/${encodeURIComponent(entry.id)}`);
    if (res.ok) await load();
    else setMessage({ kind: "error", text: `${entry.email} n'a pas pu être retiré. Réessayez.` });
    setBusy(false);
  }

  async function sendTest() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const res = await call<{ ok: boolean; to?: string }>("POST", "/admin/shop-waitlist/test", {});
    if (res.ok) setMessage({ kind: "ok", text: `Test envoyé${res.data?.to ? ` à ${res.data.to}` : ""}.` });
    else setMessage({ kind: "error", text: "Le test n'a pas pu être envoyé (échec de l'envoi du mail). Réessayez." });
    setBusy(false);
  }

  async function announce() {
    if (busy) return;
    const typed = window.prompt(`Cela envoie l'annonce à ${count} personne(s) puis supprime leurs adresses. Tapez ENVOYER pour confirmer.`);
    if (typed !== "ENVOYER") return;
    setBusy(true);
    setMessage(null);
    const res = await call<{ sent: number; failed: number; remaining: number }>("POST", "/admin/shop-waitlist/announce", { confirm: "ENVOYER" });
    if (res.ok && res.data) {
      setMessage({ kind: res.data.failed > 0 ? "error" : "ok", text: `${res.data.sent} envoyés, ${res.data.failed} échecs, ${res.data.remaining} restants.` });
      await load();
    } else {
      setMessage({ kind: "error", text: "L'envoi de l'annonce a échoué. Vérifiez la liste avant de réessayer." });
    }
    setBusy(false);
  }

  return (
    <div className="wl-tab">
      <div className="wl-eyebrow">Nasap Shop</div>
      <div className="wl-title">Liste d'attente Nasap Shop</div>
      <p className="wl-help">
        Liste éphémère : à l'ouverture, “Envoyer l'annonce” envoie un e-mail à chacun puis supprime l'adresse. Pour retirer quelqu'un avant, bouton Retirer.
      </p>

      <div className="wl-bar">
        <div className="wl-count">
          <strong>{entries ? count : "…"}</strong> inscrit{count > 1 ? "s" : ""}
        </div>
        <div className="wl-actions">
          <button type="button" className="wl-btn" disabled={busy} onClick={sendTest}>
            M'envoyer un test
          </button>
          <button type="button" className="wl-btn wl-btn-danger" disabled={busy || !entries || count === 0} onClick={announce}>
            Envoyer l'annonce et vider la liste
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {message && <div className={message.kind === "ok" ? "wl-ok" : "wl-error"}>{message.text}</div>}
        {loadError && <div className="wl-error">Impossible de charger la liste. Rechargez la page.</div>}
      </div>

      {!entries && !loadError && <div className="wl-loading">Chargement de la liste…</div>}
      {entries && entries.length === 0 && <div className="wl-loading">Personne n'est inscrit pour l'instant.</div>}

      {entries && entries.length > 0 && (
        <div className="wl-scroll">
          <table className="wl-table">
            <thead>
              <tr>
                <th scope="col">E-mail</th>
                <th scope="col">Inscrit le</th>
                <th scope="col">
                  <span className="wl-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="wl-mail">{e.email}</td>
                  <td>{new Date(e.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="wl-right">
                    <button type="button" className="wl-btn wl-btn-sm" disabled={busy} aria-label={`Retirer ${e.email}`} onClick={() => remove(e)}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .wl-tab { max-width: 1000px; margin: 0 auto; padding: 44px 24px 60px; color: #f3f1ec; }
        .wl-eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .wl-title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 14px; }
        .wl-help { font: 400 13px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.7); margin: 0 0 22px; max-width: 70ch; }
        .wl-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .wl-count { font: 500 14px 'Inter',sans-serif; color: rgba(255,255,255,.7); }
        .wl-count strong { font: 700 22px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-right: 4px; }
        .wl-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .wl-btn { min-height: 44px; padding: 0 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,.2); background: #201d1b; color: #f3f1ec; font: 600 13px 'Inter',sans-serif; cursor: pointer; }
        .wl-btn:hover:not(:disabled) { border-color: rgba(255,255,255,.4); }
        .wl-btn:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; }
        .wl-btn:disabled { opacity: .5; cursor: not-allowed; }
        .wl-btn-danger { background: #ff5a3c; border-color: #ff5a3c; color: #161514; }
        .wl-btn-danger:hover:not(:disabled) { background: #ff7a61; border-color: #ff7a61; }
        .wl-btn-sm { min-height: 36px; padding: 0 14px; font-size: 12px; }
        .wl-ok, .wl-error { border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font: 500 12.5px/1.5 'Inter',sans-serif; }
        .wl-ok { border: 1px solid rgba(120,200,140,.35); background: rgba(120,200,140,.08); color: #9fd8ae; }
        .wl-error { border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.08); color: #ff8a70; }
        .wl-loading { font: 400 13px 'Inter',sans-serif; color: rgba(255,255,255,.6); padding: 12px 0; }
        .wl-scroll { overflow-x: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; }
        .wl-table { width: 100%; border-collapse: collapse; font: 400 13px 'Inter',sans-serif; }
        .wl-table th { text-align: left; font: 600 11.5px 'Inter',sans-serif; letter-spacing: .6px; text-transform: uppercase; color: rgba(255,255,255,.6); padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,.1); }
        .wl-table td { padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,.06); color: #f3f1ec; }
        .wl-table tr:last-child td { border-bottom: none; }
        .wl-mail { word-break: break-all; }
        .wl-right { text-align: right; }
        .wl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        @media (max-width: 640px) { .wl-tab { padding: 28px 16px 48px; } .wl-actions { width: 100%; } .wl-actions .wl-btn { flex: 1 1 100%; } }
      `}</style>
    </div>
  );
}
