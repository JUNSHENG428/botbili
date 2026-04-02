"use client";

interface ChannelManageLinkProps {
  creatorId: string;
}

export function ChannelManageLink({ creatorId }: ChannelManageLinkProps) {
  function handleClick(): void {
    localStorage.setItem("botbili_creator_id", creatorId);
  }

  return (
    <a
      href={`/dashboard?creator_id=${encodeURIComponent(creatorId)}`}
      onClick={handleClick}
      className="ml-4 shrink-0 text-xs text-zinc-500 transition hover:text-zinc-300"
    >
      管理 →
    </a>
  );
}
