import { apiHandler, jsonError } from "../../../../../../lib/api/handler";
import { prisma } from "../../../../../../lib/server/prisma";
import { readFileByKey, deleteFile } from "../../../../../../lib/server/storage";

// Direct port of GET /admin/contact-messages/:id/files/:fileId, minus the
// requireAdmin check it originally had. Deliberately not session-gated:
// clicking the link straight from the notification email (Gmail app,
// phone, whatever device) shouldn't require also being logged into the
// site as admin in that exact browser — the admin reported hitting an auth
// error doing exactly that. Security instead comes from the URL itself: it
// needs BOTH ids to be a matching pair (each a cuid(), effectively
// unguessable), the email carrying it only ever goes to CONTACT_NOTIFY_EMAIL
// (a private inbox the admin controls), and the file is deleted from
// storage on this first successful download (below) — so even a leaked
// link stops working the moment it's used once, same one-time-use property
// a real auth check would add on top of, not instead of.
export const GET = apiHandler(async (context) => {
  const { id, fileId } = context.params;
  const file = await prisma.contactMessageFile.findFirst({ where: { id: fileId, contactMessageId: id } });
  if (!file) return jsonError(404, "not_found");
  if (file.downloadedAt) return jsonError(410, "already_downloaded", { downloadedAt: file.downloadedAt });

  const buffer = await readFileByKey(file.fileKey);
  await deleteFile(file.fileKey);
  await prisma.contactMessageFile.update({ where: { id: file.id }, data: { downloadedAt: new Date() } });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      "Content-Type": "application/octet-stream",
    },
  });
});
