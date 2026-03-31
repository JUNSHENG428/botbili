import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const baseStyles =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-60";

interface GhostButtonLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

interface GhostButtonNativeProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: undefined;
}

type GhostButtonProps = GhostButtonLinkProps | GhostButtonNativeProps;

export function GhostButton(props: GhostButtonProps) {
  if (props.href) {
    const { href, children, className } = props;
    return (
      <Link href={href} className={cn(baseStyles, className)}>
        {children}
      </Link>
    );
  }

  const { className, type = "button", href: _, ...rest } = props as GhostButtonNativeProps;
  return (
    <button
      type={type}
      className={cn(baseStyles, className)}
      {...rest}
    />
  );
}
