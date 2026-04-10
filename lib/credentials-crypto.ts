/**
 * 平台凭证加密/解密工具
 * 使用 AES-256-GCM 加密存储 Cookie
 */

import crypto from "node:crypto";

const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function validateKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY environment variable is required");
  }
  if (ENCRYPTION_KEY.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be exactly 32 bytes (256 bits)");
  }
  return Buffer.from(ENCRYPTION_KEY, "utf8");
}

export function encrypt(text: string): string {
  const key = validateKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // 格式: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = validateKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
