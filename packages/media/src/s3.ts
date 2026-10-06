import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { isProductionObjectStorage } from "@reelstorm/domain";

function client() {
  const endpoint = process.env.S3_ENDPOINT;
  const forcePath =
    process.env.S3_FORCE_PATH_STYLE === "1" ||
    process.env.S3_FORCE_PATH_STYLE === "true" ||
    Boolean(endpoint); // MinIO + R2 usually need path-style
  return new S3Client({
    region:
      process.env.S3_REGION ||
      (endpoint?.includes("r2.cloudflarestorage.com") ? "auto" : "us-east-1"),
    endpoint: endpoint || undefined,
    forcePathStyle: forcePath,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "minio",
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "minio123",
    },
  });
}

export function bucket() {
  return process.env.S3_BUCKET || "reelstorm";
}

/** Readiness probe — production R2/S3 vs local MinIO */
export async function probeObjectStorage(): Promise<{
  status: "pass" | "partial" | "fail";
  detail: string;
}> {
  const endpoint = process.env.S3_ENDPOINT || "";
  if (!isProductionObjectStorage()) {
    return {
      status: "fail",
      detail: endpoint
        ? `Local/dev storage (${endpoint}) — set Cloudflare R2 or AWS S3 for ~1000 users`
        : "S3_* not configured for production",
    };
  }
  try {
    await client().send(new HeadBucketCommand({ Bucket: bucket() }));
    return {
      status: "pass",
      detail: `Reachable bucket=${bucket()} endpoint=${endpoint || "aws"}`,
    };
  } catch (e) {
    return {
      status: "partial",
      detail: `Configured but HeadBucket failed: ${(e as Error).message}`,
    };
  }
}

export async function uploadFile(
  key: string,
  filePath: string,
  contentType?: string,
): Promise<{ key: string; bucket: string }> {
  const Body = createReadStream(filePath);
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body,
      ContentType: contentType,
    }),
  );
  return { key, bucket: bucket() };
}

export async function uploadBuffer(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<{ key: string; bucket: string }> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, bucket: bucket() };
}

export async function getObjectStream(key: string): Promise<Readable> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  return res.Body as Readable;
}

export async function deleteObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function presignGet(key: string, expiresIn = 3600) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

export async function presignPut(key: string, contentType: string, expiresIn = 3600) {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export function publicUrl(key: string) {
  const base = process.env.S3_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) return `${endpoint.replace(/\/$/, "")}/${bucket()}/${key}`;
  return `s3://${bucket()}/${key}`;
}
