import { apiHandler, json, jsonError } from "../../../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../../../lib/api/auth";
import { prisma } from "../../../../../../../lib/server/prisma";
import { readFileByKey, deleteFile } from "../../../../../../../lib/server/storage";

// Direct port of GET /admin/orders/:orderId/items/:itemId/file — original
// STL/3MF upload for one order line, kept only as long as it's needed for
// printing.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id: orderId, itemId } = context.params;

  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { quoteJob: true } });
  if (!item || item.orderId !== orderId || !item.quoteJob || item.quoteJob.fileDeletedAt) {
    return jsonError(404, "not_found");
  }

  const buffer = await readFileByKey(item.quoteJob.fileKey);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${item.quoteJob.fileName.replace(/"/g, "")}"`,
      "Content-Type": "application/octet-stream",
    },
  });
});

// Direct port of DELETE /admin/orders/:orderId/items/:itemId/file —
// reclaims storage for a line whose file is no longer needed (printing
// done). Idempotent — returns ok if already deleted.
export const DELETE = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id: orderId, itemId } = context.params;

  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { quoteJob: true } });
  if (!item || item.orderId !== orderId || !item.quoteJob) {
    return jsonError(404, "not_found");
  }
  if (item.quoteJob.fileDeletedAt) return json({ ok: true });

  await deleteFile(item.quoteJob.fileKey);
  await prisma.quoteJob.update({ where: { id: item.quoteJob.id }, data: { fileDeletedAt: new Date() } });
  return json({ ok: true });
});
