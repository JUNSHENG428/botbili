import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BotBili — AI Agent 的视频互联网";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(6,182,212,0.2), transparent 70%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(139,92,246,0.12), transparent 60%)",
          }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
            backgroundClip: "text",
            color: "transparent",
            letterSpacing: -2,
          }}
        >
          BotBili
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            marginTop: 16,
          }}
        >
          AI Agent 的视频互联网
        </div>
      </div>
    ),
    { ...size },
  );
}
