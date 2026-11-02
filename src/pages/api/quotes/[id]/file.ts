import { apiHandler, jsonError } from "../../../../lib/api/handler";
import { getSessionUser } from "../../../../lib/api/auth";
import { getGuestSessionId } from "../../../../lib/api/cookies";
import { prisma } from "../../../../lib/server/prisma";
import { readFileByKey } from "../../../../lib/server/storage";

// Direct port of GET /quotes/:id/file — the original upload, for the owner
// only, powers the real-geometry preview in the cart (viewer3d.js) instead
// of a placeholder cube.
export const GET = apiHandler(async (context) => {
  const { id } = context.params;
  const quoteJob = await prisma.quoteJob.findUnique({ where: { id } });
  if (!quoteJob) return jsonError(404, "not_found");

  const user = await getSessionUser(context);
  const sessionId = getGuestSessionId(context.cookies);
  const owns = (user && quoteJob.userId === user.id) || (!user && sessionId && quoteJob.sessionId === sessionId);
  if (!owns) return jsonError(404, "not_found");

  const asciiName = quoteJob.fileName.replace(/[^\x20-\x7e]|["\\%]/g, "_");
  const buffer = await readFileByKey(quoteJob.fileKey);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(quoteJob.fileName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`,
      "Content-Type": "application/octet-stream",
    },
  });
});
