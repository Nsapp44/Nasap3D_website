import { useState } from "react";
import { api } from "../../lib/api-client";

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']).{8,}$/;

interface Props {
  token: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

export default function ResetPasswordPanel({ token, onDone, onError }: Props) {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!PASSWORD_RE.test(newPwd)) {
      onError("Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 caractère spécial.");
      return;
    }
    if (newPwd !== confirmPwd) {
      onError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    const res = await api.resetPassword(token, newPwd);
    setBusy(false);
    if (!res.ok) {
      const errKey = (res.data as { error?: string } | null)?.error;
      onError(errKey === "invalid_or_expired_token" ? "Ce lien de réinitialisation est invalide ou a expiré." : "Une erreur est survenue, merci de réessayer.");
      return;
    }
    window.history.replaceState({}, "", "/compte");
    onDone("Mot de passe mis à jour, vous pouvez vous connecter.");
  }

  return (
    <div className="reset-wrap">
      <div className="reset-head">
        <div className="reset-eyebrow">Réinitialisation</div>
        <div className="reset-title">Choisissez un nouveau mot de passe</div>
      </div>
      <div className="reset-box">
        <div className="reset-fields">
          <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} type="password" placeholder="Nouveau mot de passe" className="reset-input" />
          <input value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} type="password" placeholder="Confirmer le mot de passe" className="reset-input" />
        </div>
        <div className="reset-hint">8 caractères minimum, avec au moins 1 majuscule et 1 caractère spécial.</div>
        <div onClick={submit} className="reset-submit">
          Valider le nouveau mot de passe
        </div>
      </div>

      <style>{`
        .reset-wrap { max-width: 400px; margin: 60px auto; padding: 0 24px; }
        .reset-head { text-align: center; margin-bottom: 28px; }
        .reset-eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .reset-title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .reset-box { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 26px; }
        .reset-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
        .reset-input { width: 100%; box-sizing: border-box; height: 38px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; padding: 0 12px; font: 12px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .reset-hint { font: 400 9.5px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.4); margin-bottom: 14px; }
        .reset-submit { text-align: center; background: #ff5a3c; color: #161514; font: 600 12.5px 'Inter',sans-serif; padding: 11px; border-radius: 7px; cursor: pointer; }
      `}</style>
    </div>
  );
}
