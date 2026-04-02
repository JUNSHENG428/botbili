/**
 * 获取管理员邮箱。必须设置 ADMIN_EMAIL 环境变量。
 */
export function getAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL environment variable is required");
  }
  return email;
}

/**
 * 检查是否为管理员
 */
export function isAdmin(userEmail: string | undefined): boolean {
  if (!userEmail) return false;
  try {
    return userEmail === getAdminEmail();
  } catch {
    return false;
  }
}
