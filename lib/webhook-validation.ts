/**
 * R2-01: SSRF防护 — Webhook target_url 校验
 *
 * 验证 webhook URL 是否安全可访问：
 * 1. 必须使用 https:// 协议
 * 2. Hostname 不得为 localhost / *.local / *.internal
 * 3. Hostname 不得解析为 RFC 1918 私网 IP、链路本地地址或环回地址
 */

// 私网 IP 范围（RFC 1918 + 链路本地 + 环回 + 多播）
const PRIVATE_IP_RANGES: Array<{ prefix: string; bits: number }> = [
  { prefix: "10.", bits: 8 },        // RFC 1918: 10.0.0.0/8
  { prefix: "172.16.", bits: 12 },   // RFC 1918: 172.16.0.0/12 (172.16.x - 172.31.x)
  { prefix: "192.168.", bits: 16 },  // RFC 1918: 192.168.0.0/16
  { prefix: "169.254.", bits: 16 },  // Link-local: 169.254.0.0/16
  { prefix: "127.", bits: 8 },       // Loopback: 127.0.0.0/8
  { prefix: "0.", bits: 8 },         // This network: 0.0.0.0/8
  { prefix: "100.64.", bits: 10 },   // CGNAT: 100.64.0.0/10
  { prefix: "198.18.", bits: 15 },   // Benchmark: 198.18.0.0/15
  { prefix: "198.51.100.", bits: 24 }, // Documentation: 198.51.100.0/24
  { prefix: "203.0.113.", bits: 24 },  // Documentation: 203.0.113.0/24
  { prefix: "224.", bits: 4 },       // Multicast: 224.0.0.0/4
  { prefix: "240.", bits: 4 },       // Reserved: 240.0.0.0/4
];

// 172.16.x.x — 172.31.x.x 完整检测
function isRfc1918172Range(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length < 2) return false;
  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);
  return first === 172 && second >= 16 && second <= 31;
}

function isPrivateIp(ip: string): boolean {
  // IPv6 loopback and link-local
  if (ip === "::1" || ip.toLowerCase().startsWith("fe80:") || ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) {
    return true;
  }
  // IPv4-mapped IPv6 e.g. ::ffff:10.0.0.1
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) {
    return isPrivateIp(ipv4Mapped[1]);
  }

  if (isRfc1918172Range(ip)) return true;

  for (const range of PRIVATE_IP_RANGES) {
    if (ip.startsWith(range.prefix)) return true;
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
]);

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".local")) return true;
  if (lower.endsWith(".internal")) return true;
  if (lower.endsWith(".localhost")) return true;
  if (lower.endsWith(".lan")) return true;
  if (lower.endsWith(".corp")) return true;
  // Bare IP check
  if (isPrivateIp(lower)) return true;
  return false;
}

/**
 * 验证 webhook target_url 是否允许：
 * - 协议必须为 https
 * - Hostname 不能是内网/保留域名
 * - Hostname 不能直接是私网 IP
 *
 * 注意：此函数执行静态 hostname 检查，无法防御 DNS 重绑定攻击。
 * 如需更强保护，应在发出 fetch 请求前再次解析 IP 并校验。
 */
export function isAllowedWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // 只允许 https 协议
  if (parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // 检查被封锁的 hostname
  if (isBlockedHostname(hostname)) {
    return false;
  }

  return true;
}

/**
 * 若 URL 不允许则返回描述原因的错误消息，否则返回 null。
 */
export function getWebhookUrlValidationError(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL format";
  }

  if (parsed.protocol !== "https:") {
    return "Webhook target_url must use https:// scheme";
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    return "Webhook target_url must not point to private, internal, or localhost addresses";
  }

  return null;
}
