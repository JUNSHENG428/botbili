import { ImageResponse } from "next/og";

import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const alt = "BotBili Creator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface UserOgImageProps {
  params: Promise<{ username: string }>;
}

interface CreatorRow {
  owner_id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

async function resolveAuthor(username: string) {
  const admin = createAdminClient();
  const normalized = username.trim().toLowerCase();

  const { data: creator } = await admin
    .from("creators")
    .select("owner_id, slug, name, avatar_url, bio")
    .eq("slug", normalized)
    .limit(1)
    .maybeSingle<CreatorRow>();

  if (creator?.owner_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", creator.owner_id)
      .maybeSingle<ProfileRow>();

    const { data: recipes } = await admin
      .from("recipes")
      .select("star_count, status, visibility")
      .eq("author_id", creator.owner_id)
      .eq("author_type", "ai_agent")
      .eq("status", "published")
      .eq("visibility", "public");

    const publishedRecipes = recipes ?? [];

    return {
      authorType: "ai_agent" as const,
      username:
        profile?.username?.trim() || creator.slug?.trim() || normalized,
      displayName:
        creator.name?.trim() || profile?.display_name?.trim() || normalized,
      avatarUrl: creator.avatar_url ?? profile?.avatar_url ?? null,
      bio: creator.bio ?? null,
      recipeCount: publishedRecipes.length,
      totalStars: publishedRecipes.reduce((sum, recipe) => sum + ((recipe as { star_count?: number }).star_count ?? 0), 0),
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", normalized)
    .limit(1)
    .maybeSingle<ProfileRow>();

  if (!profile?.id) {
    return null;
  }

  const { data: recipes } = await admin
    .from("recipes")
    .select("star_count")
    .eq("author_id", profile.id)
    .eq("author_type", "human")
    .eq("status", "published")
    .eq("visibility", "public");

  const publishedRecipes = recipes ?? [];

  return {
    authorType: "human" as const,
    username: profile.username?.trim() || normalized,
    displayName: profile.display_name?.trim() || profile.username?.trim() || normalized,
    avatarUrl: profile.avatar_url ?? null,
    bio: null,
    recipeCount: publishedRecipes.length,
    totalStars: publishedRecipes.reduce((sum, recipe) => sum + ((recipe as { star_count?: number }).star_count ?? 0), 0),
  };
}

export default async function UserOgImage({ params }: UserOgImageProps): Promise<ImageResponse> {
  const { username } = await params;
  const author = await resolveAuthor(username);

  if (!author) {
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
              "linear-gradient(135deg, rgba(12,18,32,1) 0%, rgba(9,9,11,1) 45%, rgba(76,29,149,1) 100%)",
            color: "#fafafa",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          创作者不存在
        </div>
      ),
      size,
    );
  }

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
            "linear-gradient(135deg, rgba(12,18,32,1) 0%, rgba(11,14,24,1) 42%, rgba(23,37,84,1) 100%)",
          color: "#fafafa",
          padding: "56px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(34,211,238,0.24), transparent 34%), radial-gradient(circle at bottom right, rgba(96,165,250,0.18), transparent 28%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            justifyContent: "space-between",
            alignItems: "stretch",
            gap: "36px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
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
                BotBili Creator
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: 64, fontWeight: 800 }}>
                <span>{truncateText(author.displayName, 18)}</span>
                <span>{author.authorType === "ai_agent" ? "🤖" : "👤"}</span>
              </div>
              <div style={{ fontSize: 28, color: "#cbd5e1" }}>@{truncateText(author.username, 22)}</div>
              <div style={{ fontSize: 24, color: "#a1a1aa", maxWidth: "720px", lineHeight: 1.5 }}>
                {truncateText(
                  author.bio ?? "分享可执行的 AI 视频工作流，让更多人发现、Fork 并运行这些 Recipe。",
                  96,
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  borderRadius: "24px",
                  border: "1px solid rgba(82,82,91,0.45)",
                  background: "rgba(9,9,11,0.56)",
                  padding: "22px 24px",
                  minWidth: "180px",
                }}
              >
                <div style={{ fontSize: 18, color: "#a1a1aa" }}>Recipe</div>
                <div style={{ fontSize: 40, fontWeight: 800 }}>{author.recipeCount}</div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  borderRadius: "24px",
                  border: "1px solid rgba(82,82,91,0.45)",
                  background: "rgba(9,9,11,0.56)",
                  padding: "22px 24px",
                  minWidth: "220px",
                }}
              >
                <div style={{ fontSize: 18, color: "#a1a1aa" }}>Total Stars</div>
                <div style={{ fontSize: 40, fontWeight: 800 }}>⭐ {author.totalStars}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              width: "260px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "999px",
                background: "rgba(24,24,27,0.85)",
                border: "1px solid rgba(113,113,122,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                fontSize: "54px",
              }}
            >
              {author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatarUrl} alt={author.displayName} width="140" height="140" />
              ) : (
                <span>{author.authorType === "ai_agent" ? "🤖" : author.displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                padding: "16px 20px",
                borderRadius: "20px",
                background: "rgba(8,145,178,0.12)",
                color: "#67e8f9",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              botbili.com
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
