// Emails tied to the order lifecycle (EXPERTISE -> AWAITING_PAYMENT -> PENDING,
// or EXPERTISE -> REJECTED). Kept separate from the checkout/admin routes
// (both need these) rather than duplicated in either.
import { sendMail } from "./mailer";
import { renderEmailHtml, orderPlacedContentHtml, orderAcceptedContentHtml, orderRejectedContentHtml } from "./emailTemplate";

function frontUrl() {
  return process.env.FRONT_URL || "http://localhost:3000";
}

function eur(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

// Sent to the customer right after "Passer la commande pour expertise" —
// no payment has happened yet, this just confirms the order was received
// and is queued for a feasibility check.
export async function sendOrderPlacedEmail(to: string, ref: string, totalCents: number) {
  try {
    const accountUrl = `${frontUrl()}/compte`;
    await sendMail(
      to,
      `Commande ${ref} reçue — expertise en cours`,
      `Nous avons bien reçu votre commande ${ref} (${eur(totalCents)}).\n\nAvant tout paiement, nous vérifions que votre pièce peut être réalisée telle quelle (24 à 48h maximum). Vous recevrez un email dès que ce sera fait, avec le lien pour régler le paiement — si vous ne recevez rien passé ce délai, n'hésitez pas à revenir voir votre compte.\n\nSuivez l'avancement depuis votre compte : ${accountUrl}`,
      renderEmailHtml(`Commande ${ref} reçue`, orderPlacedContentHtml(ref, eur(totalCents), accountUrl)),
    );
  } catch (err) {
    console.error("[orderEmails] order-placed email failed", err);
  }
}

// Sent once the admin accepts the order at the expertise stage — the
// customer can now pay (button in their account).
export async function sendOrderAcceptedEmail(to: string, ref: string, totalCents: number) {
  try {
    const accountUrl = `${frontUrl()}/compte`;
    await sendMail(
      to,
      `Commande ${ref} acceptée — paiement à finaliser`,
      `Bonne nouvelle : votre commande ${ref} (${eur(totalCents)}) a été validée après expertise.\n\nIl ne reste plus qu'à régler le paiement pour lancer la production — direction votre compte : ${accountUrl}\n\nÀ bientôt !`,
      renderEmailHtml(`Commande ${ref} acceptée`, orderAcceptedContentHtml(ref, eur(totalCents), accountUrl)),
    );
  } catch (err) {
    console.error("[orderEmails] order-accepted email failed", err);
  }
}

// Sent when the admin declines the order at the expertise stage (never
// paid) — kept polite/non-technical, points to contact rather than
// explaining why in the email itself (the reason is discussed by reply).
export async function sendOrderRejectedEmail(to: string, ref: string) {
  try {
    const contactUrl = `${frontUrl()}/contact`;
    await sendMail(
      to,
      `Commande ${ref} — problème de faisabilité`,
      `Après examen, nous ne sommes malheureusement pas en mesure de réaliser votre commande ${ref} telle quelle.\n\nAucun paiement n'a été prélevé. Répondez à cet email ou passez par le formulaire de contact (${contactUrl}) en indiquant le numéro de commande — nous serons ravis d'en discuter et de voir ce qui est possible.`,
      renderEmailHtml(`Commande ${ref} — problème de faisabilité`, orderRejectedContentHtml(ref, contactUrl)),
    );
  } catch (err) {
    console.error("[orderEmails] order-rejected email failed", err);
  }
}

// Admin-facing: a new order needs review, fired at submission time (not
// payment time) since that's when expertise is actually needed.
export async function notifyAdminOrderToReview(ref: string, customerEmail: string, totalCents: number) {
  const notify = process.env.ORDER_NOTIFY_EMAIL;
  if (!notify) return;
  try {
    await sendMail(
      notify,
      `Nouvelle commande à expertiser — ${ref}`,
      `Nouvelle commande sur nasap3d.com, en attente d'expertise (pas encore payée).\n\nRéférence : ${ref}\nClient : ${customerEmail}\nTotal si acceptée : ${eur(totalCents)}\n\nVoir dans l'admin : ${frontUrl()}/admin`,
    );
  } catch (err) {
    console.error("[orderEmails] admin review notification failed", err);
  }
}

// Admin-facing: payment just confirmed (webhook) — production can start.
export async function notifyAdminOrderPaid(ref: string, customerEmail: string | null | undefined, totalCents: number) {
  const notify = process.env.ORDER_NOTIFY_EMAIL;
  if (!notify) return;
  try {
    await sendMail(
      notify,
      `Commande payée — ${ref} — ${eur(totalCents)}`,
      `Commande payée sur nasap3d.com.\n\nRéférence : ${ref}\nClient : ${customerEmail || "(email inconnu)"}\nTotal : ${eur(totalCents)}\n\nVoir dans l'admin : ${frontUrl()}/admin`,
    );
  } catch (err) {
    console.error("[orderEmails] admin paid notification failed", err);
  }
}
