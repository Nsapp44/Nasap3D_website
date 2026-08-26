import { useState } from "react";
import { api } from "../../lib/api-client";
import { useHcaptcha } from "../../hooks/useHcaptcha";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']).{8,}$/;

interface Props {
  onLoginSuccess: (user: { email: string; customerNo: string }) => void;
  onSignupCodeSent: (pendingId: string, email: string, expiresAt: string) => void;
  onError: (data: unknown) => void;
  onPopupMessage: (msg: string) => void;
}

// Self-contained login/signup form, including its own hCaptcha widget — a
// real React mount/unmount (this whole component disappears once logged in)
// gives every fresh appearance a fresh captcha for free, unlike the
// original's single persistent component which needed a manual
// componentDidUpdate re-mount workaround for the exact same problem (see
// Account.dc.html's long comment on _mountCaptcha).
export default function AuthPanel({ onLoginSuccess, onSignupCodeSent, onError, onPopupMessage }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const { containerRef: captchaRef, token: captchaToken, reset: resetCaptcha } = useHcaptcha();

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password.trim()) {
      onPopupMessage("Champ mail et mot de passe obligatoire");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      onPopupMessage("Format d'email invalide");
      return;
    }
    if (mode === "signup" && !PASSWORD_RE.test(password)) {
      onPopupMessage("Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 caractère spécial.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      onPopupMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!captchaToken) {
      onPopupMessage("Merci de valider la case de vérification anti-robot.");
      return;
    }
    setBusy(true);

    if (mode === "signup") {
      const res = await api.signup(email, password, captchaToken);
      setBusy(false);
      resetCaptcha();
      if (!res.ok) {
        onError(res.data);
        return;
      }
      const data = res.data as { pendingId: string; expiresAt: string };
      setPassword("");
      setConfirmPassword("");
      onSignupCodeSent(data.pendingId, email, data.expiresAt);
      return;
    }

    const res = await api.login(email, password, captchaToken, rememberMe);
    setBusy(false);
    resetCaptcha();
    if (!res.ok) {
      onError(res.data);
      return;
    }
    const user = (res.data as { user: { email: string; customerNo: string; role: string } }).user;
    if (user.role === "ADMIN") {
      window.location.href = "/admin";
      return;
    }
    setPassword("");
    onLoginSuccess(user);
  }

  async function forgotPassword() {
    if (!EMAIL_RE.test(email)) {
      onPopupMessage("Entrez d'abord votre adresse e-mail dans le champ ci-dessus.");
      return;
    }
    if (!captchaToken) {
      onPopupMessage("Merci de valider la case de vérification anti-robot.");
      return;
    }
    await api.forgotPassword(email, captchaToken);
    resetCaptcha();
    // Same message whether or not the address is registered — avoids
    // revealing which emails have an account.
    onPopupMessage("Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d'être envoyé.");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-head">
        <div className="auth-mode-label">{mode === "login" ? "Connexion" : "Inscription"}</div>
        <div className="auth-title">{mode === "login" ? "Content de vous revoir" : "Créer un compte"}</div>
      </div>
      <div className="auth-box">
        <div className="auth-fields">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="auth-input" />
          <div className="pwd-wrap">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              className="auth-input pwd-input"
            />
            <span onClick={() => setShowPassword((v) => !v)} className="pwd-toggle">
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path>
                  <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path>
                  <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path>
                  <path d="m2 2 20 20"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </span>
          </div>
          {mode === "signup" && (
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Confirmer le mot de passe"
              className="auth-input"
            />
          )}
        </div>
        {mode === "signup" && <div className="auth-hint">8 caractères minimum, avec au moins 1 majuscule et 1 caractère spécial.</div>}
        {mode === "login" && (
          <div className="auth-row">
            <label className="remember-label">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="remember-checkbox" />
              Se souvenir de moi
            </label>
            <span onClick={forgotPassword} className="forgot-link">
              Mot de passe oublié ?
            </span>
          </div>
        )}
        <div ref={captchaRef} className="captcha-slot" />
        <div onClick={submit} className="auth-submit">
          {mode === "login" ? "Se connecter" : "S'inscrire"}
        </div>
        <div className="auth-switch">
          {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <span
            onClick={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setPassword("");
              setConfirmPassword("");
            }}
            className="auth-switch-action"
          >
            {mode === "login" ? "S'inscrire" : "Se connecter"}
          </span>
        </div>
      </div>

      <style>{`
        .auth-wrap { max-width: 400px; margin: 60px auto; padding: 0 24px; }
        .auth-head { text-align: center; margin-bottom: 28px; }
        .auth-mode-label { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .auth-title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .auth-box { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 26px; }
        .auth-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
        .auth-input { width: 100%; box-sizing: border-box; height: 38px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; padding: 0 12px; font: 12px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .pwd-wrap { position: relative; }
        .pwd-input { padding-right: 40px; }
        .pwd-toggle { position: absolute; right: 12px; top: 0; height: 38px; display: flex; align-items: center; color: rgba(255,255,255,.55); cursor: pointer; user-select: none; }
        .auth-hint { font: 400 9.5px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.4); margin-bottom: 12px; }
        .auth-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .remember-label { display: flex; align-items: center; gap: 6px; font: 500 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.55); cursor: pointer; user-select: none; }
        .remember-checkbox { width: 13px; height: 13px; accent-color: #ff5a3c; cursor: pointer; }
        .forgot-link { font: 500 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); cursor: pointer; }
        .captcha-slot { display: flex; justify-content: center; margin-bottom: 14px; }
        .auth-submit { text-align: center; background: #ff5a3c; color: #161514; font: 600 12.5px 'Inter',sans-serif; padding: 11px; border-radius: 7px; cursor: pointer; }
        .auth-switch { text-align: center; margin-top: 16px; font: 400 11px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .auth-switch-action { color: #ff5a3c; cursor: pointer; font-weight: 600; }
      `}</style>
    </div>
  );
}
