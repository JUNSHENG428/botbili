"use client";

interface SparkLineProps {
  data: { date: string; count: number }[];
}

export function SparkLine({ data }: SparkLineProps) {
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 200;
  const H = 40;
  const PAD = 4;

  const pts = data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1 || 1)) * (W - PAD * 2);
      const y = H - PAD - (d.count / max) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-teal-400"
      />
    </svg>
  );
}
