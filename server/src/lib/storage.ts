import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// S3-compatible storage for uploads + generated invoice PDFs, with a local-disk
// fallback when S3 isn't configured yet (see server/.env.example) — lets the
// whole quote flow be developed/tested before OVH object storage is set up.
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
    const { putObject } = await import("./s3.js");
    await putObject(key, data);
    return;
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key), data);
}

export async function readFileByKey(key: string): Promise<Buffer> {
  if (s3Configured()) {
    const { getObject } = await import("./s3.js");
    return getObject(key);
  }
  return readFile(path.join(LOCAL_DIR, key));
}
