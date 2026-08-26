import type { useAccount } from "../../hooks/useAccount";

type Account = ReturnType<typeof useAccount>;

export default function SettingsPanel({ account }: { account: Account }) {
  const {
    authEmail,
    customerNo,
    goDashboard,
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
    requestEmailChange,
    requestPasswordChange,
    requestDelete,
  } = account;

  return (
    <div className="settings">
      <div onClick={goDashboard} className="back-link">
        ← Retour à mon compte
      </div>
      <div className="settings-eyebrow">Réglages</div>
      <div className="settings-title">Détails du compte</div>

      <div className="settings-card">
        <div className="card-title">Adresse e-mail</div>
        <div className="card-sub">Actuelle : {authEmail}</div>
        <div className="card-sub customer-row">
          N° de client : <span className="customer-no-badge">{customerNo}</span>
          <span className="customer-no-note">— rattaché à vos factures</span>
        </div>
        <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="Nouvelle adresse e-mail" className="field-input" />
        <input value={emailCurPwd} onChange={(e) => setEmailCurPwd(e.target.value)} type="password" placeholder="Mot de passe actuel (confirmation)" className="field-input" style={{ marginBottom: "14px" }} />
        <div onClick={requestEmailChange} className="submit-btn">
          Mettre à jour l'e-mail
        </div>
      </div>

      <div className="settings-card">
        <div className="card-title" style={{ marginBottom: "14px" }}>
          Mot de passe
        </div>
        <div className="field-col">
          <input value={curPwd} onChange={(e) => setCurPwd(e.target.value)} type="password" placeholder="Mot de passe actuel" className="field-input" />
          <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} type="password" placeholder="Nouveau mot de passe" className="field-input" />
          <input value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} type="password" placeholder="Confirmer le nouveau mot de passe" className="field-input" />
        </div>
        <div className="field-hint">8 caractères minimum, avec au moins 1 majuscule et 1 caractère spécial.</div>
        <div onClick={requestPasswordChange} className="submit-btn">
          Changer le mot de passe
        </div>
      </div>

      <div className="danger-card">
        <div className="card-title">Supprimer le compte</div>
        <div className="danger-text">La suppression est définitive : vos commandes et factures ne seront plus accessibles.</div>
        <input value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} type="password" placeholder="Mot de passe actuel (confirmation)" className="field-input delete-input" />
        <div onClick={requestDelete} className="danger-btn">
          Supprimer mon compte
        </div>
      </div>

      <style>{`
        .settings { max-width: 900px; margin: 0 auto; padding: 44px 24px 60px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font: 500 11.5px 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-bottom: 22px; transition: color .2s ease; }
        .back-link:hover { color: #ff5a3c; }
        .settings-eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 8px; }
        .settings-title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 26px; }
        .settings-card { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 22px; margin-bottom: 16px; max-width: 520px; }
        .card-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 4px; }
        .card-sub { font: 400 11px 'Inter',sans-serif; color: rgba(255,255,255,.45); margin-bottom: 6px; }
        .customer-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .customer-no-badge { font: 600 11px ui-monospace,monospace; color: #ff5a3c; background: rgba(255,90,60,.1); border-radius: 4px; padding: 2px 8px; }
        .customer-no-note { font: 400 9.5px 'Inter',sans-serif; color: rgba(255,255,255,.35); }
        .field-input { width: 100%; box-sizing: border-box; height: 38px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; padding: 0 12px; font: 12px 'Inter',sans-serif; color: #e8e6e1; outline: none; margin-bottom: 10px; }
        .field-col { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
        .field-col .field-input { margin-bottom: 0; }
        .field-hint { font: 400 9.5px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.4); margin-bottom: 14px; }
        .submit-btn { display: inline-block; background: #ff5a3c; color: #161514; font: 600 12px 'Inter',sans-serif; padding: 10px 18px; border-radius: 7px; cursor: pointer; }
        .danger-card { border: 1px solid rgba(255,90,60,.3); border-radius: 12px; background: rgba(255,90,60,.06); padding: 22px; max-width: 520px; }
        .danger-text { font: 400 11px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.5); margin-bottom: 14px; }
        .delete-input { max-width: 300px; margin-bottom: 14px; }
        .danger-btn { display: inline-block; border: 1px solid #ff5a3c; color: #ff5a3c; font: 600 12px 'Inter',sans-serif; padding: 10px 18px; border-radius: 7px; cursor: pointer; transition: background .2s ease, color .2s ease; }
        .danger-btn:hover { background: #ff5a3c; color: #161514; }
      `}</style>
    </div>
  );
}
