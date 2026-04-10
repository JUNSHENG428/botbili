"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

const STEPS = [
  { text: "openclaw run botbili/tech-daily-report", delay: 0 },
  { text: "✓ Script generated (847 words)", delay: 800 },
  { text: "✓ Video rendered → uploading to BotBili...", delay: 1600 },
];

export function StepOneVisual() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [currentChar, setCurrentChar] = useState<number>(0);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    let charInterval: NodeJS.Timeout | null = null;

    const startAnimation = () => {
      setVisibleLines(0);
      setCurrentChar(0);

      // Type first line character by character
      const firstLineLength = STEPS[0].text.length;
      let charIndex = 0;

      charInterval = setInterval(() => {
        charIndex++;
        setCurrentChar(charIndex);

        if (charIndex >= firstLineLength) {
          if (charInterval) clearInterval(charInterval);
          
          // Show second line after delay
          timeouts.push(
            setTimeout(() => {
              setVisibleLines(1);
              
              // Show third line after delay
              timeouts.push(
                setTimeout(() => {
                  setVisibleLines(2);
                  
                  // Reset after completion
                  timeouts.push(
                    setTimeout(() => {
                      startAnimation();
                    }, 2000)
                  );
                }, 800)
              );
            }, 600)
          );
        }
      }, 30); // ~2.5s total for typing

      timeouts.push(charInterval as unknown as NodeJS.Timeout);
    };

    startAnimation();

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      if (charInterval) clearInterval(charInterval);
    };
  }, []);

  return (
    <GlassCard className="overflow-hidden border-zinc-800/80 bg-zinc-950/90 p-0 font-mono">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 bg-zinc-900/50 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <span className="ml-2 text-xs text-zinc-500">openclaw</span>
      </div>

      {/* Terminal content */}
      <div className="space-y-1 p-4 text-sm">
        {/* Prompt line with typing effect */}
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-cyan-400">$</span>
          <span className="text-zinc-200">
            {STEPS[0].text.slice(0, currentChar)}
            {currentChar < STEPS[0].text.length && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-cyan-400" />
            )}
          </span>
        </div>

        {/* Second line */}
        {visibleLines >= 1 && (
          <div className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="shrink-0 text-transparent">$</span>
            <span className="text-green-400">{STEPS[1].text}</span>
          </div>
        )}

        {/* Third line */}
        {visibleLines >= 2 && (
          <div className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="shrink-0 text-transparent">$</span>
            <span className="text-green-400">{STEPS[2].text}</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
