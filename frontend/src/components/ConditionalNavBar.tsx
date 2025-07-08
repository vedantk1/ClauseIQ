"use client";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function ConditionalNavBar() {
  const pathname = usePathname();

  // Hide navbar on review page (handles both /review and /review with query params)
  if (pathname.startsWith("/review")) {
    return null;
  }

  return <NavBar />;
}
