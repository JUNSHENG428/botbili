"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavbarVisibilityProps {
  children: ReactNode;
}

export function NavbarVisibility({ children }: NavbarVisibilityProps) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}
