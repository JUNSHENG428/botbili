import { ImageResponse } from "next/og";

import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const alt = "BotBili Recipe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface RecipeOgImageProps {
  params: Promise<{ id: string }>;
}

interface RecipeRow {
  id: string;
  slug: string;
  author_id: string;
  author_type: "human" | "ai_agent";
  title: string;
  description: string | null;
  star_count: number;
  fork_count: number;
  exec_count: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  platforms: string[] | null;
  platform: string[] | null;
}

interface ProfileRow {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface CreatorRow {
  slug: string | null;
  name: string;
  avatar_url: string | null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function getRecipePlatforms(recipe: RecipeRow): string[] {
  if (Array.isArray(recipe.platforms) && recipe.platforms.length > 0) {
    return recipe.platforms;
  }

  if (Array.isArray(recipe.platform) && recipe.platform.length > 0) {
    return recipe.platform;
  }

  return [];
}

function getDifficultyLabel(difficulty: RecipeRow["difficulty"]): string {
  const labels: Record<RecipeRow["difficulty"], string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return labels[difficulty] ?? difficulty;
}

function getAvatarLabel(name: string, authorType: RecipeRow["author_type"]): string {
  if (authorType === "ai_agent") {
    return "🤖";
  }

  return name.slice(0, 1).toUpperCase();
}

async function loadRecipe(identifier: string) {
  const admin = createAdminClient();

  const { data: recipeById, error: recipeByIdError } = await admin
    .from("recipes")
    .select("id, slug, author_id, author_type, title, description, star_count, fork_count, exec_count, difficulty, platforms, platform")
    .eq("id", identifier)
    .maybeSingle<RecipeRow>();

  if (recipeByIdError) {
    throw new Error(`按 id 读取 Recipe 失败: ${recipeByIdError.message}`);
  }

  const recipe = recipeById
    ? recipeById
    : (
        await admin
          .from("recipes")
          .select("id, slug, author_id, author_type, title, description, star_count, fork_count, exec_count, difficulty, platforms, platform")
          .eq("slug", identifier)
          .maybeSingle<RecipeRow>()
      ).data;

  if (!recipe) {
    return null;
  }

  const [{ data: profile, error: profileError }, { data: creator, error: creatorError }] = await Promise.all([
    admin
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", recipe.author_id)
      .maybeSingle<ProfileRow>(),
    admin
      .from("creators")
      .select("slug, name, avatar_url")
      .eq("owner_id", recipe.author_id)
      .limit(1)
      .maybeSingle<CreatorRow>(),
  ]);

  if (profileError) {
    throw new Error(`读取作者资料失败: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`读取创作者资料失败: ${creatorError.message}`);
  }

  const username =
    profile?.username?.trim() ||
    creator?.slug?.trim() ||
    profile?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
    `user-${recipe.author_id.slice(0, 8)}`;

  const displayName = profile?.display_name?.trim() || creator?.name?.trim() || username;
  const avatarUrl = profile?.avatar_url ?? creator?.avatar_url ?? null;

  return {
    recipe,
    author: {
      username,
      displayName,
      avatarUrl,
    },
  };
}

export default async function RecipeOgImage({ params }: RecipeOgImageProps): Promise<ImageResponse> {
  const { id } = await params;
  const payload = await loadRecipe(id);

  if (!payload) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, rgba(8,47,73,1) 0%, rgba(9,9,11,1) 45%, rgba(76,29,149,1) 100%)",
            color: "#fafafa",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Recipe 不存在
        </div>
      ),
      size,
    );
  }

  const { recipe, author } = payload;
  const platforms = getRecipePlatforms(recipe).slice(0, 3);
  const title = truncateText(recipe.title, 46);
  const description = truncateText(recipe.description ?? "发现、执行、分享 AI 视频生产工作流。", 88);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, rgba(12,18,32,1) 0%, rgba(11,14,24,1) 38%, rgba(17,24,39,1) 100%)",
          color: "#fafafa",
          padding: "56px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(34,211,238,0.28), transparent 34%), radial-gradient(circle at bottom right, rgba(139,92,246,0.22), transparent 28%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            justifyContent: "space-between",
            gap: "42px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#67e8f9",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                BotBili Recipe
              </div>

              <div
                style={{
                  fontSize: 64,
                  lineHeight: 1.08,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  maxWidth: "720px",
                }}
              >
                {title}
              </div>

              <div
                style={{
                  fontSize: 28,
                  lineHeight: 1.4,
                  color: "#cbd5e1",
                  maxWidth: "760px",
                }}
              >
                {description}
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {platforms.map((platform) => (
                  <div
                    key={platform}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid rgba(161,161,170,0.28)",
                      borderRadius: "999px",
                      padding: "10px 18px",
                      fontSize: 22,
                      color: "#e4e4e7",
                      background: "rgba(24,24,27,0.55)",
                    }}
                  >
                    {platform}
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid rgba(34,211,238,0.28)",
                    borderRadius: "999px",
                    padding: "10px 18px",
                    fontSize: 22,
                    color: "#67e8f9",
                    background: "rgba(8,145,178,0.12)",
                  }}
                >
                  {getDifficultyLabel(recipe.difficulty)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid rgba(82,82,91,0.45)",
                paddingTop: "24px",
              }}
            >
              <div style={{ display: "flex", gap: "26px", color: "#e5e7eb", fontSize: 24 }}>
                <div style={{ display: "flex", gap: "10px" }}>⭐ {recipe.star_count}</div>
                <div style={{ display: "flex", gap: "10px" }}>🍴 {recipe.fork_count}</div>
                <div style={{ display: "flex", gap: "10px" }}>▶️ {recipe.exec_count}</div>
              </div>
              <div style={{ display: "flex", fontSize: 22, color: "#a1a1aa" }}>botbili.com</div>
            </div>
          </div>

          <div
            style={{
              width: "280px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                padding: "28px",
                borderRadius: "28px",
                border: "1px solid rgba(82,82,91,0.45)",
                background: "rgba(9,9,11,0.56)",
              }}
            >
              <div
                style={{
                  width: "92px",
                  height: "92px",
                  borderRadius: "999px",
                  background: "rgba(24,24,27,0.85)",
                  border: "1px solid rgba(113,113,122,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  fontSize: "38px",
                }}
              >
                {author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={author.avatarUrl} alt={author.displayName} width="92" height="92" />
                ) : (
                  <span>{getAvatarLabel(author.displayName, recipe.author_type)}</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: 30, fontWeight: 700 }}>
                  <span>{truncateText(author.displayName, 16)}</span>
                  <span>{recipe.author_type === "ai_agent" ? "🤖" : "👤"}</span>
                </div>
                <div style={{ fontSize: 22, color: "#a1a1aa" }}>@{truncateText(author.username, 18)}</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px 20px",
                borderRadius: "20px",
                background: "rgba(8,145,178,0.12)",
                color: "#67e8f9",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              GitHub for AI Video Recipes
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
