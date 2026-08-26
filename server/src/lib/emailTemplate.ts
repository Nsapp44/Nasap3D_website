// Gabarit HTML partagé pour tous les emails transactionnels (design généré
// via Gemini à partir d'un prompt décrivant la charte du site — palette,
// typographie, contraintes de compatibilité email — puis nettoyé ici d'un
// problème d'encodage introduit par le copier-coller, et découpé en un
// gabarit + un contenu par type d'email plutôt que 7 fichiers dupliqués).
// Mise en page en <table> + CSS inline : les clients mail (Outlook en
// particulier) ne supportent ni flexbox ni grid ni <style> externe fiable.
const LOGO_URL = "https://nasap3d.com/assets/logo-blanc-full.png";

// Tout contenu inséré dans le gabarit peut contenir des valeurs saisies par
// un client (nom, email, message du formulaire de contact...) — jamais
// interpolées sans échappement, sinon un expéditeur malveillant pourrait
// injecter du HTML dans l'email reçu par l'admin.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailHtml(title: string, contentHtml: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="fr">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#161514;font-family:'Inter',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#161514;margin:0;padding:24px 0;">
<tr>
<td align="center" style="padding:0 12px;">
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#161514;">
<tr>
<td align="left" style="padding:12px 24px 28px 24px;border-bottom:1px solid #282624;">
<a href="https://nasap3d.com" target="_blank" style="text-decoration:none;display:inline-block;">
<img src="${LOGO_URL}" alt="Nasap3D" width="140" height="52" style="display:block;border:0;outline:none;" />
</a>
</td>
</tr>
<tr>
<td align="left" style="padding:32px 24px;">
${contentHtml}
</td>
</tr>
<tr>
<td align="left" style="padding:24px 24px 12px 24px;border-top:1px solid #282624;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8a8782;">
<p style="margin:0 0 8px 0;color:#8a8782;">Ceci est un message automatique, merci de ne pas y répondre directement.</p>
<p style="margin:0 0 12px 0;color:#8a8782;">Nasap3D &mdash; Atelier d'impression 3D<br />29 rue Mellier, 44100 Nantes</p>
<p style="margin:0;color:#8a8782;"><a href="https://nasap3d.com" target="_blank" style="color:#ff5a3c;text-decoration:underline;">nasap3d.com</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:28px;color:#f3f1ec;letter-spacing:-0.2px;">${escapeHtml(text)}</h1>`;
}

function p(html: string, opts?: { small?: boolean; margin?: string }): string {
  const size = opts?.small ? "13px" : "15px";
  const lineHeight = opts?.small ? "20px" : "22px";
  const color = opts?.small ? "#8a8782" : "#f3f1ec";
  return `<p style="margin:${opts?.margin ?? "0 0 20px 0"};font-family:'Inter',Arial,Helvetica,sans-serif;font-size:${size};line-height:${lineHeight};color:${color};">${html}</p>`;
}

export function verificationCodeContentHtml(introText: string, code: string): string {
  // Pas d'espace inséré dans le texte lui-même (un visiteur qui copie-colle le
  // code récupérerait l'espace, que le champ de saisie n'accepte pas) — la
  // séparation visuelle des chiffres vient uniquement du letter-spacing CSS
  // ci-dessous.
  return [
    h1("Code de vérification"),
    p(`${escapeHtml(introText)} Ce code est valable 3 minutes.`, { margin: "0 0 24px 0" }),
    `<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr><td align="center" style="background-color:#1e1d1b;border:1px solid #33312e;border-radius:4px;padding:20px;">
<span style="font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;letter-spacing:8px;color:#ff5a3c;display:block;line-height:36px;">${escapeHtml(code)}</span>
</td></tr>
</table>`,
    p("Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.", {
      small: true,
      margin: "0",
    }),
  ].join("\n");
}

export function passwordResetContentHtml(resetUrl: string): string {
  return [
    h1("Réinitialisation de mot de passe"),
    p(
      "Une demande de réinitialisation de mot de passe a été effectuée pour votre compte. Cliquez sur le bouton ci-dessous pour en définir un nouveau :",
      { margin: "0 0 24px 0" },
    ),
    `<table border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr><td align="center" style="background-color:#ff5a3c;border-radius:4px;">
<a href="${escapeHtml(resetUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#161514;text-decoration:none;min-height:20px;line-height:20px;">Réinitialiser mon mot de passe</a>
</td></tr>
</table>`,
    p(
      "Ce lien expire dans 60 minutes. Si vous n'avez pas demandé cette réinitialisation, aucune action n'est requise.",
      { small: true, margin: "0" },
    ),
  ].join("\n");
}

function orderInfoTable(rows: Array<[string, string, string?]>): string {
  const trs = rows
    .map(([label, value, valueColor], i) => {
      const border = i < rows.length - 1 ? "border-bottom:1px solid #33312e;" : "";
      return `<tr>
<td style="${border}color:#8a8782;width:40%;padding:6px 0;">${escapeHtml(label)}</td>
<td style="${border}font-weight:600;padding:6px 0;${valueColor ? `color:${valueColor};` : ""}">${escapeHtml(value)}</td>
</tr>`;
    })
    .join("\n");
  return `<table width="100%" border="0" cellpadding="12" cellspacing="0" style="background-color:#1e1d1b;border:1px solid #33312e;border-radius:4px;margin:0 0 24px 0;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:14px;color:#f3f1ec;">
${trs}
</table>`;
}

export function orderPlacedContentHtml(ref: string, totalLabel: string, accountUrl: string): string {
  return [
    h1("Commande reçue"),
    p(
      "Nous avons bien reçu votre commande d'impression 3D. Avant tout paiement, nous vérifions que la pièce peut être réalisée telle quelle (24 à 48h maximum) :",
    ),
    orderInfoTable([
      ["Référence :", ref],
      ["Statut :", "Expertise en cours", "#ff5a3c"],
      ["Montant si acceptée :", totalLabel],
    ]),
    p(
      `Vous recevrez un email dès que l'expertise sera terminée, avec le lien pour régler le paiement. Suivez l'avancement depuis <a href="${escapeHtml(accountUrl)}" style="color:#ff5a3c;text-decoration:underline;">votre compte</a>.`,
      { margin: "0" },
    ),
  ].join("\n");
}

export function orderAcceptedContentHtml(ref: string, totalLabel: string, accountUrl: string): string {
  return [
    h1("Commande acceptée"),
    p("Bonne nouvelle : votre commande a été validée après expertise."),
    orderInfoTable([
      ["Référence :", ref],
      ["Statut :", "Paiement à finaliser", "#ff5a3c"],
      ["Montant :", totalLabel],
    ]),
    `<table border="0" cellpadding="0" cellspacing="0" style="margin:0;">
<tr><td align="center" style="background-color:#ff5a3c;border-radius:4px;">
<a href="${escapeHtml(accountUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#161514;text-decoration:none;min-height:20px;line-height:20px;">Finaliser le paiement</a>
</td></tr>
</table>`,
  ].join("\n");
}

export function orderRejectedContentHtml(ref: string, contactUrl: string): string {
  return [
    h1("Problème de faisabilité"),
    p("Après examen, nous ne sommes malheureusement pas en mesure de réaliser votre commande telle quelle."),
    orderInfoTable([
      ["Référence :", ref],
      ["Statut :", "Non réalisable en l'état", "#ff5a3c"],
    ]),
    p(
      `Aucun paiement n'a été prélevé. Répondez à cet email ou passez par le <a href="${escapeHtml(contactUrl)}" style="color:#ff5a3c;text-decoration:underline;">formulaire de contact</a> en indiquant le numéro de commande — nous serons ravis d'en discuter et de voir ce qui est possible.`,
      { margin: "0" },
    ),
  ].join("\n");
}

// Accusé de réception envoyé à l'expéditeur du formulaire de contact — texte
// fixe, `name`/`subject` sont les deux seules valeurs issues du formulaire et
// restent échappées comme partout ailleurs dans ce fichier.
export function contactConfirmationContentHtml(name: string, subject: string): string {
  return [
    h1("Message bien reçu"),
    p(`Bonjour ${escapeHtml(name)},`, { margin: "0 0 16px 0" }),
    p(
      `Nous avons bien reçu votre message${subject ? ` « ${escapeHtml(subject)} »` : ""} et revenons vers vous dans les meilleurs délais.`,
    ),
    p("Ceci est une confirmation automatique — inutile de renvoyer votre message.", { small: true, margin: "0" }),
  ].join("\n");
}

// Contenu entièrement issu du formulaire public — chaque valeur doit être
// échappée, un expéditeur du formulaire ne doit jamais pouvoir injecter du
// HTML dans l'email reçu par l'admin.
export function contactNotificationContentHtml(
  name: string,
  email: string,
  subject: string,
  message: string,
  attachments: Array<{ url: string; name: string }> = [],
): string {
  const attachmentLine = attachments.length
    ? "<br /><br /><strong>Pièces jointes :</strong><br />" +
      attachments
        .map((a) => `<a href="${escapeHtml(a.url)}" style="color:#ff5a3c;text-decoration:underline;">${escapeHtml(a.name)}</a>`)
        .join("<br />")
    : "";
  return [
    h1("Nouveau message reçu"),
    p("Un message a été déposé via le formulaire de contact du site :"),
    `<table width="100%" border="0" cellpadding="16" cellspacing="0" style="background-color:#1e1d1b;border-left:3px solid #ff5a3c;border-radius:2px;margin:0;">
<tr><td style="font-family:'Inter',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#f3f1ec;">
<strong>Expéditeur :</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br />
<strong>Sujet :</strong> ${escapeHtml(subject)}<br /><br />
${escapeHtml(message).replace(/\n/g, "<br />")}${attachmentLine}
</td></tr>
</table>`,
  ].join("\n");
}
