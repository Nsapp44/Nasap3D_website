import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

// AWS SDK v3's default Node HTTP handler has NO timeout at all unless one
// is configured — confirmed the same failure mode as boxtal.ts's bare
// fetch() calls: a slow/unresponsive S3 endpoint would hang putObject/
// getObject/deleteObject forever, leaking a socket permanently. Real risk
// here: deleteObject is called from the 15-minute cleanup sweep (see
// cartCleanup.ts/quoteCleanup.ts) — one hung call there means that sweep
// never finishes, and the next setInterval tick 15 minutes later piles
// another on top, accumulating indefinitely rather than recovering.
//
// throwOnRequestTimeout is required, not optional: without it, this
// version of @smithy/node-http-handler treats requestTimeout as a WARNING
// only — it logs "a request has exceeded the configured requestTimeout"
// and keeps waiting forever (see setRequestTimeout in its dist-cjs). The
// first version of this fix shipped without it and therefore only
// actually bounded the connection phase. socketTimeout is a second,
// independent backstop for a socket that goes silent mid-response.
const requestHandler = new NodeHttpHandler({
  connectionTimeout: 5_000,
  requestTimeout: 15_000,
  throwOnRequestTimeout: true,
  socketTimeout: 20_000,
});

function client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "eu-west-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    requestHandler,
  });
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: data }));
}

export async function getObject(key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}
