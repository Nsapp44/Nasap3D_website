import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api-client";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import OrdersTab from "./OrdersTab";
import StockTab from "./StockTab";

interface Settings {
  quoteEnabled: boolean;
  hourlyRateCents: number;
  minUnitPriceCents: number;
  dailyOrderLimit: number;
}

export default function AdminPage() {
  const authStatus = useAdminAuth();
  const [tab, setTab] = useState<"orders" | "stock">("orders");
  const [settings, setSettings] = useState<Settings | null>(null);

  const loadSettings = useCallback(async () => {
    const res = await api.adminGetSettings();
    if (res.ok && res.data) setSettings((res.data as { settings: Settings }).settings);
  }, []);

  useEffect(() => {
    if (authStatus === "ok") loadSettings();
  }, [authStatus, loadSettings]);

  async function adminLogout() {
    await api.logout();
    window.location.href = "/compte";
  }

  async function toggleQuote() {
    if (!settings) return;
    const next = !settings.quoteEnabled;
    setSettings({ ...settings, quoteEnabled: next });
    await api.adminUpdateSettings({ quoteEnabled: next });
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <a href="/" className="logo-link">
          <img src="/assets/logo-blanc-full.png" alt="Nasap3D" className="logo-img" />
          <span className="admin-badge">ADMIN</span>
        </a>
        {authStatus === "ok" && (
          <div className="admin-tabs">
            <span onClick={() => setTab("orders")} className={`admin-tab${tab === "orders" ? " active" : ""}`}>
              Commandes
            </span>
            <span onClick={() => setTab("stock")} className={`admin-tab${tab === "stock" ? " active" : ""}`}>
              Stock filament
            </span>
          </div>
        )}
        <div className="admin-account">
          {authStatus === "ok" && (
            <span onClick={adminLogout} className="logout-link">
              Déconnexion
            </span>
          )}
        </div>
      </div>

      {authStatus === "checking" && <div className="auth-msg">Vérification des droits d'accès…</div>}

      {authStatus === "denied" && (
        <div className="auth-denied">
          <div className="auth-denied-title">Accès réservé</div>
          <div className="auth-denied-text">Cette page est réservée aux administrateurs.</div>
          <a href="/compte" className="auth-denied-cta">
            Aller à mon compte
          </a>
        </div>
      )}

      {authStatus === "ok" && (
        <>
          <div className="quote-bar-wrap">
            <div className={`quote-bar${settings?.quoteEnabled ? "" : " paused"}`}>
              <div className="quote-bar-left">
                <span className={`quote-badge${settings?.quoteEnabled ? "" : " paused"}`}>{settings?.quoteEnabled ? "EN LIGNE" : "EN PAUSE"}</span>
                <div>
                  <div className="quote-bar-title">Devis instantané — {settings?.quoteEnabled ? "en ligne" : "en pause"}</div>
                  <div className="quote-bar-hint">
                    {settings?.quoteEnabled
                      ? "Actif : les clients peuvent déposer un fichier et commander. Coupez-le pendant vos congés."
                      : "En pause : le configurateur est masqué partout (accueil + page dédiée). Les visiteurs voient un message d'indisponibilité."}
                  </div>
                </div>
              </div>
              <span className={`quote-track${settings?.quoteEnabled ? " on" : ""}`} onClick={toggleQuote}>
                <span className={`quote-knob${settings?.quoteEnabled ? " on" : ""}`} />
              </span>
            </div>
          </div>

          {tab === "orders" && <OrdersTab />}
          {tab === "stock" && <StockTab settings={settings} onSettingsSaved={loadSettings} />}
        </>
      )}

      <style>{`
        .admin-page { background: #161514; min-height: 100vh; }
        .admin-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .logo-link { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-img { height: 34px; width: auto; }
        .admin-badge { font: 700 9px 'Inter',sans-serif; color: #161514; background: #ff5a3c; border-radius: 4px; padding: 3px 7px; margin-left: 4px; }
        .admin-tabs { display: flex; gap: 26px; font: 500 13px 'Inter',sans-serif; color: rgba(255,255,255,.62); }
        .admin-tab { cursor: pointer; padding-bottom: 4px; color: rgba(255,255,255,.5); font-weight: 500; border-bottom: 2px solid transparent; }
        .admin-tab.active { color: #f3f1ec; font-weight: 600; border-bottom: 2px solid #ff5a3c; }
        .admin-account { display: flex; align-items: center; gap: 18px; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.75); }
        .logout-link { cursor: pointer; color: rgba(255,255,255,.6); font: 500 12px 'Inter',sans-serif; transition: color .2s ease; }
        .logout-link:hover { color: #ff5a3c; }
        .auth-msg { max-width: 1000px; margin: 0 auto; padding: 60px 24px; text-align: center; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .auth-denied { max-width: 600px; margin: 60px auto; padding: 0 24px; text-align: center; }
        .auth-denied-title { font: 700 20px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 10px; }
        .auth-denied-text { font: 400 12px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-bottom: 20px; }
        .auth-denied-cta, .auth-denied-cta:hover { text-decoration: none; color: #161514; }
        .auth-denied-cta { display: inline-block; background: #ff5a3c; font: 600 12px 'Inter',sans-serif; padding: 10px 18px; border-radius: 7px; }
        .quote-bar-wrap { max-width: 1000px; margin: 0 auto; padding: 24px 24px 0; }
        .quote-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; border: 1px solid rgba(255,255,255,.1); background: #1a1917; border-radius: 12px; padding: 16px 20px; }
        .quote-bar.paused { border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.08); }
        .quote-bar-left { display: flex; align-items: center; gap: 14px; }
        .quote-badge { font: 700 9px 'Inter',sans-serif; letter-spacing: .5px; padding: 5px 9px; border-radius: 5px; flex: none; background: rgba(143,209,158,.15); color: #8fd19e; }
        .quote-badge.paused { background: rgba(255,90,60,.18); color: #ff5a3c; }
        .quote-bar-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 2px; }
        .quote-bar-hint { font: 400 10.5px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.55); max-width: 640px; }
        .quote-track { width: 46px; height: 24px; border-radius: 12px; position: relative; cursor: pointer; flex: none; background: rgba(255,255,255,.15); transition: background .2s ease; display: inline-block; }
        .quote-track.on { background: #ff5a3c; }
        .quote-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .2s ease; }
        .quote-knob.on { left: 25px; }
      `}</style>
    </div>
  );
}
