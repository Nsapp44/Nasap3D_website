import type { useAccount } from "../../hooks/useAccount";

type Account = ReturnType<typeof useAccount>;

// The account page's two overlay popups: the generic message/confirm/verify-
// code modal (hasPopup in the original) and the separate cancel-order
// confirm. Kept together since both are simple, low-state overlays.
export default function PopupModals({ account }: { account: Account }) {
  const {
    popupMessage,
    popupConfirm,
    closePopup,
    confirmPopup,
    verifyCode,
    setVerifyCode,
    verifyBusy,
    verifyMessage,
    verifyMessageOk,
    canResendCode,
    codeExpired,
    remainingSec,
    submitVerify,
    resendCode,
    cancelOrderPopup,
    setCancelOrderPopup,
    cancelBusy,
    confirmCancelOrder,
  } = account;

  const verifyReady = verifyCode.trim().length === 6 && !verifyBusy;
  const countdownLabel = codeExpired ? "Code expiré." : `Code valable encore ${String(Math.floor(remainingSec / 60)).padStart(2, "0")}:${String(remainingSec % 60).padStart(2, "0")}`;

  return (
    <>
      {!!popupMessage && (
        <div className="popup-backdrop">
          <div className="popup-modal">
            <div className="popup-text">{popupMessage}</div>

            {popupConfirm === null && (
              <div onClick={closePopup} className="popup-ok-btn">
                OK
              </div>
            )}

            {popupConfirm === "delete" && (
              <div className="popup-btn-row">
                <div onClick={closePopup} className="popup-btn-cancel">
                  Annuler
                </div>
                <div onClick={confirmPopup} className="popup-btn-danger">
                  Supprimer
                </div>
              </div>
            )}

            {popupConfirm === "verify-code" && (
              <>
                <input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="verify-input"
                />
                <div className="verify-countdown">{countdownLabel}</div>
                {verifyMessage && <div className={`verify-message${verifyMessageOk ? " ok" : ""}`}>{verifyMessage}</div>}
                <div className="popup-btn-row" style={{ marginBottom: "12px" }}>
                  <div onClick={closePopup} className="popup-btn-cancel">
                    Annuler
                  </div>
                  <div onClick={submitVerify} className={`popup-btn-confirm${verifyReady ? " ready" : ""}`}>
                    Confirmer
                  </div>
                </div>
                <div onClick={() => canResendCode && resendCode()} className={`resend-link${canResendCode ? " active" : ""}`}>
                  Renvoyer le code
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cancelOrderPopup && (
        <div className="popup-backdrop">
          <div className="popup-modal">
            <div className="popup-text">Êtes-vous sûr de vouloir supprimer la commande ?</div>
            <div className="popup-btn-row">
              <div onClick={() => setCancelOrderPopup(null)} className="popup-btn-cancel">
                Retour
              </div>
              <div onClick={confirmCancelOrder} className="popup-btn-danger">
                {cancelBusy ? "…" : "Annuler la commande"}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .popup-backdrop { position: fixed; inset: 0; background: rgba(10,10,10,.7); display: flex; align-items: center; justify-content: center; z-index: 50; animation: popupBackdropIn .2s ease; }
        .popup-modal { width: 340px; max-width: 90vw; background: #1a1917; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 24px; text-align: center; animation: popupModalIn .35s cubic-bezier(.2,.9,.3,1.1); }
        .popup-text { font: 500 12.5px/1.6 'Inter',sans-serif; color: #f3f1ec; margin-bottom: 18px; }
        .popup-ok-btn { display: inline-block; background: #ff5a3c; color: #161514; font: 600 12px 'Inter',sans-serif; padding: 9px 20px; border-radius: 6px; cursor: pointer; }
        .popup-btn-row { display: flex; gap: 10px; justify-content: center; }
        .popup-btn-cancel { border: 1px solid rgba(255,255,255,.2); color: #f3f1ec; font: 600 12px 'Inter',sans-serif; padding: 9px 18px; border-radius: 6px; cursor: pointer; }
        .popup-btn-danger { background: #ff5a3c; color: #161514; font: 600 12px 'Inter',sans-serif; padding: 9px 18px; border-radius: 6px; cursor: pointer; }
        .verify-input { width: 140px; box-sizing: border-box; height: 40px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; padding: 0 12px; font: 16px ui-monospace,monospace; letter-spacing: 4px; text-align: center; color: #e8e6e1; outline: none; margin-bottom: 8px; }
        .verify-countdown { margin-bottom: 12px; font: 500 10.5px ui-monospace,monospace; color: rgba(255,255,255,.4); }
        .verify-message { margin-bottom: 12px; font: 600 11px 'Inter',sans-serif; color: #ff8a70; }
        .verify-message.ok { color: #4ade80; }
        .popup-btn-confirm { background: #3a3936; color: rgba(255,255,255,.4); font: 600 12px 'Inter',sans-serif; padding: 9px 16px; border-radius: 6px; cursor: not-allowed; }
        .popup-btn-confirm.ready { background: #ff5a3c; color: #161514; cursor: pointer; }
        .resend-link { font: 500 11px 'Inter',sans-serif; color: rgba(255,255,255,.25); cursor: not-allowed; }
        .resend-link.active { color: rgba(255,255,255,.5); cursor: pointer; text-decoration: underline; }
        @keyframes popupBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popupModalIn { 0% { opacity: 0; transform: scale(.9) translateY(12px); } 70% { opacity: 1; transform: scale(1.02) translateY(0); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </>
  );
}
