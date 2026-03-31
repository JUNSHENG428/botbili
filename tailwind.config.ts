import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ===== 色彩 Token =====
      colors: {
        canvas: "#09090b",           // 主画布
        surface: {
          DEFAULT: "rgba(255,255,255,0.03)",
          hover: "rgba(255,255,255,0.06)",
          active: "rgba(255,255,255,0.09)",
        },
        border: {
          subtle: "rgba(255,255,255,0.08)",
          DEFAULT: "rgba(255,255,255,0.12)",
          strong: "rgba(255,255,255,0.18)",
        },
        // 品牌色 alias
        brand: {
          cyan: "#06b6d4",
          violet: "#8b5cf6",
          pink: "#ec4899",
        },
      },

      // ===== 间距 Token（限制可用值，保证一致性） =====
      spacing: {
        "page-x": "1.5rem",       // 24px 页面水平留白
        "card-gap": "1rem",       // 16px 卡片间距
        "section-gap": "3rem",    // 48px 区块间距
      },

      // ===== 圆角 Token =====
      borderRadius: {
        card: "1rem",             // 16px 卡片圆角
        button: "0.75rem",        // 12px 按钮圆角
        badge: "9999px",          // 全圆
      },

      // ===== 渐变 =====
      backgroundImage: {
        aurora: "linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)",
        "aurora-subtle": "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08), rgba(236,72,153,0.08))",
      },

      // ===== 动效 =====
      animation: {
        "aurora-drift": "aurora-drift 8s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "aurora-drift": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(30px, -20px)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.7" },
        },
      },

      // ===== 字体 =====
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Consolas", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
