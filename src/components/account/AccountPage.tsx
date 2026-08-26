import { useAccount } from "../../hooks/useAccount";
import AuthPanel from "./AuthPanel";
import ResetPasswordPanel from "./ResetPasswordPanel";
import Dashboard from "./Dashboard";
import SettingsPanel from "./SettingsPanel";
import PopupModals from "./PopupModals";

// Ported from Account.dc.html — orchestrates session/reset-token/dashboard-
// vs-settings routing, everything else is delegated to the sub-components
// above (see useAccount.ts for why the email/password-change fields live in
// the shared hook rather than local to SettingsPanel).
export default function AccountPage() {
  const account = useAccount();
  const { sessionChecked, resetToken, loggedIn, view, setPopupMessage, onLoginSuccess, onSignupCodeSent, showError } = account;

  if (!sessionChecked) return null;

  if (resetToken) {
    return (
      <>
        <ResetPasswordPanel
          token={resetToken}
          onDone={(msg) => {
            account.setResetToken(null);
            setPopupMessage(msg);
          }}
          onError={(msg) => setPopupMessage(msg)}
        />
        <PopupModals account={account} />
      </>
    );
  }

  if (!loggedIn) {
    return (
      <>
        <AuthPanel onLoginSuccess={onLoginSuccess} onSignupCodeSent={onSignupCodeSent} onError={showError} onPopupMessage={setPopupMessage} />
        <PopupModals account={account} />
      </>
    );
  }

  return (
    <>
      {view === "dashboard" && <Dashboard account={account} />}
      {view === "settings" && <SettingsPanel account={account} />}
      <PopupModals account={account} />
    </>
  );
}
