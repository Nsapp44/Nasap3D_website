import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

function client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "eu-west-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  await client().send(
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: data }),
  );
}

export async function getObject(key: string): Promise<Buffer> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}
