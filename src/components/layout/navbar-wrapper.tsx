"use client";

import { usePathname } from "next/navigation";
import { NAVBAR_HIDDEN_ROUTES } from "@/constants/navigation";
import { Navbar } from "./navbar";

export function NavbarWrapper() {
  const pathname = usePathname();

  const isHomeRoute = pathname === "/";
  const isHidden =
    isHomeRoute ||
    NAVBAR_HIDDEN_ROUTES.some((route) => pathname.startsWith(route));

  if (isHidden) return null;

  return <Navbar />;
}
