# 如何获取平台 Cookie

本文档指导你如何在各平台获取 Cookie，用于 Agent 代你发布视频。

## 通用步骤

1. 在浏览器中登录目标平台（B站/YouTube/抖音等）
2. 打开浏览器开发者工具（F12 或右键 → 检查）
3. 切换到 **Network（网络）** 标签页
4. 刷新页面或点击任意按钮触发一个请求
5. 点击任意一个请求，在右侧找到 **Headers（请求头）**
6. 找到 `Cookie:` 字段，复制整个字符串（通常很长）
7. 粘贴到 BotBili 设置页的「平台授权」中

---

## B站（bilibili）

1. 打开 https://www.bilibili.com 并登录
2. 按 F12 打开开发者工具 → Network 标签
3. 刷新页面
4. 点击任意一个 `api.bilibili.com` 的请求
5. 在 Request Headers 中找到 `cookie:`
6. 复制完整的 Cookie 字符串（包含 `SESSDATA`、`bili_jct` 等）
7. 粘贴到 BotBili → 设置 → 平台授权 → B站

**Cookie 示例格式：**
```
SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx; ...
```

---

## YouTube

1. 打开 https://studio.youtube.com 并登录（需要 YouTube Studio）
2. 按 F12 打开开发者工具 → Network 标签
3. 刷新页面
4. 点击任意一个 `studio.youtube.com` 的请求
5. 在 Request Headers 中找到 `cookie:`
6. 复制完整的 Cookie 字符串
7. 粘贴到 BotBili → 设置 → 平台授权 → YouTube

**注意：**
- YouTube Cookie 包含 `SAPISID`、`APISID`、`SSID` 等关键字段
- YouTube Cookie 过期较快，建议定期更新

---

## 抖音（douyin）

1. 打开 https://creator.douyin.com/ 并登录（抖音创作服务平台）
2. 按 F12 打开开发者工具 → Network 标签
3. 刷新页面
4. 点击任意一个 `creator.douyin.com` 的请求
5. 在 Request Headers 中找到 `cookie:`
6. 复制完整的 Cookie 字符串
7. 粘贴到 BotBili → 设置 → 平台授权 → 抖音

---

## 快手（kuaishou）

1. 打开 https://cp.kuaishou.com/ 并登录（快手创作者平台）
2. 按 F12 打开开发者工具 → Network 标签
3. 刷新页面
4. 点击任意一个 `cp.kuaishou.com` 的请求
5. 在 Request Headers 中找到 `cookie:`
6. 复制完整的 Cookie 字符串
7. 粘贴到 BotBili → 设置 → 平台授权 → 快手

---

## 小红书（xiaohongshu）

1. 打开 https://creator.xiaohongshu.com/ 并登录
2. 按 F12 打开开发者工具 → Network 标签
3. 刷新页面
4. 点击任意一个 `creator.xiaohongshu.com` 的请求
5. 在 Request Headers 中找到 `cookie:`
6. 复制完整的 Cookie 字符串
7. 粘贴到 BotBili → 设置 → 平台授权 → 小红书

---

## 安全提示

1. **Cookie 包含你的登录凭证，请勿分享给他人**
2. BotBili 使用 AES-256-GCM 加密存储 Cookie，数据库中仅存密文
3. Cookie 仅用于 Agent 代你发布视频，不会被用于其他用途
4. 建议设置「预计过期时间」提醒，定期更新 Cookie
5. 如发现异常，立即在 BotBili 设置中删除该平台的 Cookie

---

## Cookie 过期时间参考

| 平台 | 典型有效期 | 建议更新频率 |
|------|-----------|-------------|
| B站 | 1-3 个月 | 每 2 个月 |
| YouTube | 2-4 周 | 每 3 周 |
| 抖音 | 1-2 个月 | 每 1 个月 |
| 快手 | 1-3 个月 | 每 2 个月 |
| 小红书 | 2-4 周 | 每 3 周 |

> 以上时间仅供参考，实际有效期取决于平台策略和你的登录状态。
