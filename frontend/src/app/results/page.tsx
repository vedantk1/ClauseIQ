"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Results() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new Review Workspace
    router.replace("/review");
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-text-secondary">
          Redirecting to Review Workspace...
        </p>
      </div>
    </div>
  );
}
