"use client";

export function LobsterScrollButton() {
  function handleClick(): void {
    document.getElementById("developer")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/60"
    >
      我有龙虾，立刻接入
    </button>
  );
}
