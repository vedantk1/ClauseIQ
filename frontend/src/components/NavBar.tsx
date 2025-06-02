"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Upload" },
  { href: "/results", label: "Results" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="bg-gray-800 text-gray-100">
      <ul className="flex gap-6 px-6 py-3">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={clsx(
                "hover:text-white",
                path === href && "font-semibold text-white"
              )}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
