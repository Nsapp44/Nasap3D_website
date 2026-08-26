import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { api } from "../lib/api-client";
import { useHcaptcha } from "../hooks/useHcaptcha";
import PrinterLoaderIcon from "./PrinterLoaderIcon";

type FileState = "none" | "uploading" | "ready";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ported 1:1 from Contact.dc.html's Component class — same fields, same
// validation, same file-upload/drag-drop flow, same hCaptcha reset-after-
// every-submit behavior (a solved token is single-use).
export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [fileState, setFileState] = useState<FileState>("none");
  const [fileName, setFileName] = useState("");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { containerRef: captchaRef, token: captchaToken, reset: resetCaptcha } = useHcaptcha();

  const uploading = fileState === "uploading";
  const canSend = name.trim().length > 0 && EMAIL_RE.test(email) && subject.trim().length > 0 && !uploading && !submitting;

  function attachFile() {
    if (fileState !== "none") return;
    fileInputRef.current?.click();
  }

  function removeFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileState("none");
    setFileKey(null);
    setFileName("");
    setFileError(null);
  }

  async function uploadFile(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setFileError("Fichier trop volumineux (50 Mo max).");
      return;
    }
    setFileState("uploading");
    setFileError(null);
    const res = await api.uploadContactFile(file);
    if (!res.ok || !res.data) {
      setFileState("none");
      setFileError("Échec de l'envoi du fichier, réessayez.");
      return;
    }
    setFileState("ready");
    setFileName(res.data.fileName);
    setFileKey(res.data.fileKey);
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && fileState === "none") uploadFile(file);
  }

  async function submit() {
    if (!canSend) return;
    if (!captchaToken) {
      setErrorMessage("Merci de valider la case de vérification anti-robot.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    const res = await api.submitContact({
      name,
      email,
      subject,
      message,
      fileKey: fileKey ?? undefined,
      fileName: fileName || undefined,
      captchaToken,
    });
    await resetCaptcha();
    if (!res.ok) {
      setSubmitting(false);
      setErrorMessage(
        res.data && (res.data as { error?: string }).error === "captcha_failed"
          ? "Vérification anti-robot échouée, merci de cocher la case et réessayer."
          : "Échec de l'envoi, merci de réessayer dans un instant.",
      );
      return;
    }
    setSubmitting(false);
    setSent(true);
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setFileState("none");
    setFileKey(null);
    setFileName("");
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    sentTimerRef.current = setTimeout(() => setSent(false), 5000);
  }

  return (
    <div className="contact-form-box">
      <div className="field-row">
        <div>
          <label className="field-label">
            Nom <span className="required">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Votre nom"
            className="field-input"
          />
          <div className="char-count">{name.length} / 60 caractères</div>
        </div>
        <div>
          <label className="field-label">
            Email <span className="required">*</span>
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            maxLength={80}
            placeholder="vous@exemple.com"
            className="field-input"
          />
          <div className="char-count">{email.length} / 80 caractères</div>
        </div>
      </div>

      <div>
        <label className="field-label">
          Objet <span className="required">*</span>
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={80}
          placeholder="Objet ou Numéro de compte/Numéro de la commande"
          className="field-input"
        />
        <div className="char-count">{subject.length} / 80 caractères</div>
      </div>

      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message — décrivez votre besoin (pièce, contrainte, délai souhaité…)"
          maxLength={1000}
          className="field-textarea"
        />
        <div className="char-count">{message.length} / 1000 caractères</div>
      </div>

      <div>
        <input ref={fileInputRef} type="file" onChange={onFileInputChange} style={{ display: "none" }} />
        {fileState === "none" && (
          <div
            onClick={attachFile}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`file-drop${dragging ? " dragging" : ""}`}
          >
            + Joindre un fichier (pièce cassée, plan, photo…)
          </div>
        )}
        {fileError && <div className="file-error">{fileError}</div>}
        {uploading && (
          <div className="file-uploading">
            <span className="loader-icon-sm" style={{ ["--pl-nozzle-fill" as string]: "#1a1917" }}>
              <PrinterLoaderIcon maskId="plMaskContactUpload" />
            </span>
            Chargement du fichier…
          </div>
        )}
        {fileState === "ready" && (
          <div className="file-ready">
            <span>✓ {fileName}</span>
            <span onClick={removeFile} className="file-remove">
              Retirer
            </span>
          </div>
        )}
        <div className="file-hint">.stl .step .pdf .jpg .png — 50 Mo max</div>
      </div>

      <div ref={captchaRef} className="captcha-slot" />

      <div onClick={submit} className={`send-btn${canSend ? " enabled" : ""}`}>
        {uploading && (
          <span className="loader-icon-tiny">
            <PrinterLoaderIcon maskId="plMaskContactSend" />
          </span>
        )}
        <span>Envoyer le message</span>
      </div>

      {sent && <div className="sent-msg">✓ Message envoyé — nous revenons vers vous rapidement.</div>}
      {errorMessage && <div className="error-msg">{errorMessage}</div>}

      <style>{`
        .contact-form-box { display: flex; flex-direction: column; gap: 14px; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field-label { font: 600 10px 'Inter',sans-serif; color: rgba(255,255,255,.5); margin-bottom: 5px; display: block; }
        .required { color: #ff5a3c; }
        .field-input, .field-textarea {
          width: 100%; box-sizing: border-box; border: 1px solid rgba(255,255,255,.15); border-radius: 6px;
          background: #161514; font: 12px 'Inter',sans-serif; color: #e8e6e1; outline: none;
        }
        .field-input { height: 38px; padding: 0 12px; }
        .field-textarea { height: 110px; padding: 10px 12px; resize: none; font-family: inherit; }
        .char-count { font: 9px ui-monospace,monospace; color: rgba(255,255,255,.3); margin-top: 3px; text-align: right; }
        .file-drop {
          border: 1.5px dashed rgba(255,255,255,.25); border-radius: 6px; padding: 14px; font: 12px 'Inter',sans-serif;
          color: rgba(255,255,255,.4); text-align: center; cursor: pointer; transform: scale(1); background: transparent;
          box-shadow: none; transition: border-color .2s ease, background .2s ease, box-shadow .2s ease, color .2s ease, transform .2s ease;
        }
        .file-drop.dragging {
          border-color: #ff5a3c; color: #ff5a3c; transform: scale(1.05); background: rgba(255,90,60,.1);
          box-shadow: 0 0 0 3px rgba(255,90,60,.18), 0 0 18px rgba(255,90,60,.35);
        }
        .file-error { font: 600 10.5px 'Inter',sans-serif; color: #ff8a70; margin-top: 6px; }
        .file-uploading {
          border: 1.5px dashed rgba(255,90,60,.4); border-radius: 6px; padding: 32px 14px; font: 13px 'Inter',sans-serif;
          color: rgba(255,255,255,.6); text-align: center; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px;
        }
        .loader-icon-sm { width: 60px; height: 60px; display: inline-block; color: #ff5a3c; }
        .loader-icon-tiny { width: 11px; height: 11px; display: inline-block; color: #fff; --pl-nozzle-fill: #ff5a3c; }
        .file-ready {
          border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.08); border-radius: 6px; padding: 14px;
          font: 12px 'Inter',sans-serif; color: #f3f1ec; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .file-remove { flex: none; cursor: pointer; color: rgba(255,255,255,.5); font: 600 11px 'Inter',sans-serif; text-decoration: underline; }
        .file-hint { font: 9px ui-monospace,monospace; color: rgba(255,255,255,.3); margin-top: 3px; }
        .captcha-slot { display: flex; justify-content: center; margin-bottom: 14px; }
        .send-btn {
          align-self: flex-start; background: #3a3936; color: #fff; border: 1px solid rgba(255,255,255,.12);
          font: 600 13px 'Inter',sans-serif; padding: 11px 20px; border-radius: 7px; margin-top: 2px; cursor: not-allowed;
          display: flex; align-items: center; gap: 8px; transition: background .2s ease, color .2s ease;
        }
        .send-btn.enabled { background: #ff5a3c; color: #161514; border: none; cursor: pointer; }
        .sent-msg { font: 600 11px 'Inter',sans-serif; color: #ff5a3c; }
        .error-msg { font: 600 11px 'Inter',sans-serif; color: #ff8a70; }
      `}</style>
    </div>
  );
}
