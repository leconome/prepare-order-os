import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET_NAME || "prepareos";
const PUBLIC_URL =
  process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${BUCKET}`;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime] || "bin";
}

export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadProductImage(
  tenantId: string,
  file: File,
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`,
    );
  }

  const ext = extFromMime(file.type);
  const key = `${tenantId}/products/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const url = `${PUBLIC_URL}/${key}`;
  return { key, url };
}

export async function deleteImage(imageUrl: string): Promise<void> {
  const key = imageUrl.replace(`${PUBLIC_URL}/`, "");
  if (!key || key === imageUrl) {
    return;
  }

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    );
  } catch (error) {
    console.warn("Failed to delete image from S3:", error);
  }
}
