"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Upload" },
  { href: "/review", label: "Review" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/about", label: "About" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="bg-bg-surface border-b border-border-muted">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="font-heading text-xl font-semibold text-text-primary hover:text-accent-purple transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface rounded-sm"
            >
              Legal AI
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {links.map(({ href, label }) => {
                const isActive = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "relative px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface",
                      isActive
                        ? "text-text-primary bg-bg-elevated"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                    )}
                  >
                    {label}
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-accent-purple rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile menu button - for future implementation */}
          <div className="md:hidden">
            <button
              type="button"
              className="text-text-secondary hover:text-text-primary p-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple"
              aria-label="Open menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - collapsed by default, expand in future */}
      <div className="md:hidden border-t border-border-muted bg-bg-surface">
        <div className="px-6 py-3 space-y-1">
          {links.map(({ href, label }) => {
            const isActive = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "block px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface",
                  isActive
                    ? "text-text-primary bg-bg-elevated border-l-2 border-accent-purple"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
