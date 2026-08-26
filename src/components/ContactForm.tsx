import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { api } from "../lib/api-client";
import { useHcaptcha } from "../hooks/useHcaptcha";
import PrinterLoaderIcon from "./PrinterLoaderIcon";

interface AttachedFile {
  id: string;
  name: string;
  status: "uploading" | "ready" | "error";
  fileKey: string | null;
  error: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 5;

// Ported from Contact.dc.html's Component class — same fields, same
// validation, same hCaptcha reset-after-every-submit behavior (a solved
// token is single-use). Attachments were single-file in the original;
// extended to several (up to MAX_FILES, matching the server's own cap) —
// still never required to submit, only name/email/subject are.
export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { containerRef: captchaRef, token: captchaToken, reset: resetCaptcha } = useHcaptcha();

  const uploading = files.some((f) => f.status === "uploading");
  const canSend = name.trim().length > 0 && EMAIL_RE.test(email) && subject.trim().length > 0 && !uploading && !submitting;
  const canAttachMore = files.length < MAX_FILES;

  function attachFiles() {
    if (!canAttachMore) return;
    fileInputRef.current?.click();
  }

  function removeFile(id: string) {
    setFiles((cur) => cur.filter((f) => f.id !== id));
  }

  async function uploadOne(file: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (file.size > MAX_FILE_BYTES) {
      setFiles((cur) => [...cur, { id, name: file.name, status: "error", fileKey: null, error: "Fichier trop volumineux (50 Mo max)." }]);
      return;
    }
    setFiles((cur) => [...cur, { id, name: file.name, status: "uploading", fileKey: null, error: null }]);
    const res = await api.uploadContactFile(file);
    setFiles((cur) =>
      cur.map((f) =>
        f.id === id
          ? res.ok && res.data
            ? { ...f, status: "ready", fileKey: res.data.fileKey, name: res.data.fileName }
            : { ...f, status: "error", error: "Échec de l'envoi, réessayez." }
          : f,
      ),
    );
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_FILES - files.length;
    Array.from(list)
      .slice(0, Math.max(0, room))
      .forEach(uploadOne);
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
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
    addFiles(e.dataTransfer?.files ?? null);
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
      files: files.filter((f) => f.status === "ready" && f.fileKey).map((f) => ({ fileKey: f.fileKey!, fileName: f.name })),
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
    setFiles([]);
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
        <input ref={fileInputRef} type="file" multiple onChange={onFileInputChange} style={{ display: "none" }} />
        {files.map((f) => (
          <div key={f.id} className={`file-row${f.status === "error" ? " file-row-error" : ""}`}>
            {f.status === "uploading" && (
              <span className="loader-icon-tiny">
                <PrinterLoaderIcon maskId={`plMaskContactUpload-${f.id}`} />
              </span>
            )}
            <span className="file-row-name">
              {f.status === "ready" && "✓ "}
              {f.name}
              {f.status === "error" && f.error ? ` — ${f.error}` : ""}
            </span>
            <span onClick={() => removeFile(f.id)} className="file-remove">
              Retirer
            </span>
          </div>
        ))}
        {canAttachMore && (
          <div
            onClick={attachFiles}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`file-drop${dragging ? " dragging" : ""}`}
          >
            + Joindre {files.length > 0 ? "un autre fichier" : "un ou plusieurs fichiers"} (pièce cassée, plan, photo…)
          </div>
        )}
        <div className="file-hint">
          .stl .step .pdf .jpg .png — 50 Mo max par fichier, {MAX_FILES} fichiers max
        </div>
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
          margin-bottom: 6px;
        }
        .file-drop.dragging {
          border-color: #ff5a3c; color: #ff5a3c; transform: scale(1.05); background: rgba(255,90,60,.1);
          box-shadow: 0 0 0 3px rgba(255,90,60,.18), 0 0 18px rgba(255,90,60,.35);
        }
        .file-row {
          border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.08); border-radius: 6px; padding: 10px 14px;
          font: 12px 'Inter',sans-serif; color: #f3f1ec; display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
        }
        .file-row-error { border-color: rgba(255,138,112,.4); background: rgba(255,90,60,.05); }
        .file-row-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .loader-icon-tiny { width: 11px; height: 11px; display: inline-block; flex: none; color: #fff; --pl-nozzle-fill: #ff5a3c; }
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
