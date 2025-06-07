"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

const links = [
  { href: "/", label: "Upload" },
  { href: "/review", label: "Review" },
  { href: "/documents", label: "Documents" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About" },
];

export default function NavBar() {
  const path = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

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
              ClauseIQ
            </Link>

            {/* Desktop Navigation - only show if authenticated */}
            {isAuthenticated && (
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
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <div className="hidden md:flex items-center space-x-3">
                  <span className="text-sm text-text-secondary">
                    Welcome, {user?.full_name || user?.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-muted hover:border-border-primary rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-text-primary bg-accent-purple hover:bg-accent-purple/90 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
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
      </div>

      {/* Mobile Navigation - only show if authenticated */}
      {isAuthenticated && (
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
            <div className="pt-3 border-t border-border-muted">
              <div className="px-3 py-2 text-sm text-text-secondary">
                {user?.full_name || user?.email}
              </div>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
