import { createHash, randomBytes } from "node:crypto";

import { verifyApiKey as verifyApiKeyByHash } from "@/lib/upload-repository";
import type { Creator } from "@/types";

/**
 * 对 API Key 做 SHA-256 哈希。
 */
export function hashApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey, "utf8").digest("hex");
}

/**
 * 生成 BotBili API Key（仅用于创建 key 场景）。
 */
export function generateApiKey(): { plain: string; hash: string } {
  const plain = `bb_${randomBytes(16).toString("hex")}`;
  const hash = hashApiKey(plain);
  return { plain, hash };
}

/**
 * 从 Authorization 头提取 Bearer token。
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

/**
 * 通过 key 哈希验证并返回 creator。
 */
export async function verifyApiKey(keyHash: string): Promise<Creator | null> {
  return verifyApiKeyByHash(keyHash);
}
