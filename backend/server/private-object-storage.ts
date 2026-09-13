import type { S3Client } from "@aws-sdk/client-s3";

/** Minimal S3-compatible contract shared by product-specific storage clients. */
export interface PrivateObjectStorage {
  client: S3Client;
  bucket: string;
  provider: "aws_s3" | "backblaze_b2";
  region: string;
  authentication?: string;
}
