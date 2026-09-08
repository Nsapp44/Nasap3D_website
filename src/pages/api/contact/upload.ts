import path from "node:path";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { newFileKey, saveFile } from "../../../lib/server/storage";
import { enforceRateLimit, checkRateLimit, clientIp } from "../../../lib/api/rateLimit";

// Matches the front-end's total budget across every attachment combined
// (see ContactForm.tsx's MAX_TOTAL_BYTES) — this endpoint only ever sees one
// file per request, so it can't itself enforce "across every attachment",
// only "no single one blows the whole budget on its own".
const MAX_CONTACT_FILE_BYTES = 100 * 1024 * 1024;
// Matches what the contact form's UI advertises accepting (".stl .3mf .step
// .pdf .jpg .png") — the front-end input didn't actually enforce it either,
// so this was previously wide open to any file type. .3mf added: the quote
// wizard itself already accepts it (see useQuoteWizard.ts's ALLOWED_EXT) —
// this endpoint rejecting it outright was a real gap, not an intentional
// restriction.
const ALLOWED_CONTACT_EXT = new Set([".stl", ".3mf", ".step", ".stp", ".pdf", ".jpg", ".jpeg", ".png"]);

// Direct port of POST /contact/upload — real upload for the contact form's
// attachment. The file is stored (not emailed: most mailboxes reject/strip
// attachments over ~25MB, well under our 50MB cap here), and the
// notification email links to the admin download route instead.
export const POST = apiHandler(async (context) => {
  enforceRateLimit(`contact:upload:${clientIp(context)}`, 10, 60_000);
  // Filet en plus de la limite par minute ci-dessus — un vrai visiteur
  // n'approche jamais 50 pièces jointes/heure, un script en boucle si.
  if (!checkRateLimit(`contact-upload:${clientIp(context)}`, 50, 60 * 60 * 1000)) {
    return jsonError(429, "too_many_requests");
  }

  const form = await context.request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "missing_file");
  // The Web File/FormData API has no built-in truncation like
  // @fastify/multipart's `part.file.truncated` — the whole body is already
  // buffered by the time formData() resolves, so this is a plain size check
  // on what actually arrived rather than a stream-abort mid-upload.
  if (file.size > MAX_CONTACT_FILE_BYTES) return jsonError(413, "file_too_large");

  const fileName = file.name;
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_CONTACT_EXT.has(ext)) return jsonError(400, "unsupported_file_type");

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileKey = newFileKey(fileName);
  await saveFile(fileKey, fileBuffer);
  return json({ fileKey, fileName }, { status: 201 });
});
