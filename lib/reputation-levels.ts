export type ReputationLevel = "newcomer" | "contributor" | "expert" | "master" | "legend";

export function calculateLevel(totalPoints: number): ReputationLevel {
  if (totalPoints >= 10000) {
    return "legend";
  }

  if (totalPoints >= 2000) {
    return "master";
  }

  if (totalPoints >= 500) {
    return "expert";
  }

  if (totalPoints >= 100) {
    return "contributor";
  }

  return "newcomer";
}

export const levelLabel: Record<ReputationLevel, string> = {
  newcomer: "Newcomer",
  contributor: "Contributor",
  expert: "Expert",
  master: "Master",
  legend: "Legend",
};

export const levelEmoji: Record<ReputationLevel, string> = {
  newcomer: "🌱",
  contributor: "🛠",
  expert: "⚡",
  master: "🏆",
  legend: "🌌",
};

export const levelColors: Record<ReputationLevel, string> = {
  newcomer: "bg-zinc-800 text-zinc-400 border border-zinc-700",
  contributor: "bg-blue-950/80 text-blue-300 border border-blue-900",
  expert: "bg-purple-950/80 text-purple-300 border border-purple-900",
  master: "bg-amber-950/80 text-amber-300 border border-amber-900",
  legend:
    "border border-cyan-400/40 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-zinc-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]",
};
