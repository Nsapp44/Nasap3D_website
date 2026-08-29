import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

// S3-compatible storage for uploads + generated invoice PDFs, with a local-disk
// fallback when S3 isn't configured yet — lets the whole quote flow be
// developed/tested before object storage is set up. This fallback is a real,
// actively-used dev-mode code path, not dead code — keep it.
const LOCAL_DIR = path.resolve(process.cwd(), "uploads");

function s3Configured() {
  return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);
}

export function newFileKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
}

export async function saveFile(key: string, data: Buffer): Promise<void> {
  if (s3Configured()) {
    const { putObject } = await import("./s3");
    await putObject(key, data);
    return;
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key), data);
}

export async function readFileByKey(key: string): Promise<Buffer> {
  if (s3Configured()) {
    const { getObject } = await import("./s3");
    return getObject(key);
  }
  return readFile(path.join(LOCAL_DIR, key));
}

// Used by the admin "delete STL" action — the original upload is only
// needed while a piece is being sliced/printed; once that's done, keeping
// it around indefinitely just grows storage for no benefit.
export async function deleteFile(key: string): Promise<void> {
  if (s3Configured()) {
    const { deleteObject } = await import("./s3");
    await deleteObject(key);
    return;
  }
  await unlink(path.join(LOCAL_DIR, key)).catch((err) => {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  });
}
