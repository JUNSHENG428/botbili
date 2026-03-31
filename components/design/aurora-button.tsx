import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const baseStyles =
  "relative inline-flex items-center justify-center overflow-hidden rounded-lg font-medium text-white transition-all bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 hover:shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none";

interface AuroraButtonLinkProps {
  href: string;
  children: ReactNode;
  size?: "default" | "lg";
  className?: string;
}

interface AuroraButtonNativeProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: undefined;
  size?: "default" | "lg";
}

type AuroraButtonProps = AuroraButtonLinkProps | AuroraButtonNativeProps;

export function AuroraButton(props: AuroraButtonProps) {
  const size = props.size ?? "default";
  const sizeClass = size === "lg" ? "px-8 py-3.5 text-base" : "px-5 py-2.5 text-sm";

  if (props.href) {
    const { href, children, className } = props;
    return (
      <Link href={href} className={cn(baseStyles, sizeClass, className)}>
        {children}
      </Link>
    );
  }

  const { className, size: _, href: __, type = "button", ...rest } = props as AuroraButtonNativeProps;
  return (
    <button type={type} className={cn(baseStyles, sizeClass, className)} {...rest} />
  );
}
