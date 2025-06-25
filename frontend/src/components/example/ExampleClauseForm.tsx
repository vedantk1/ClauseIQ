"use client";

import { useState } from "react";

// Simple types for this example component
interface Clause {
  id?: string;
  clause_type?: string;
  risk_level?: "high" | "medium" | "low";
  summary?: string;
  risk_assessment?: string;
  text?: string;
  recommendations?: string[];
  key_points?: string[];
  heading?: string;
}

export function ExampleClauseForm() {
  const [clause, setClause] = useState<Clause | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Simple validation
      if (!clause?.clause_type || !clause?.text) {
        throw new Error("Please fill in all required fields");
      }

      console.log("Submitting clause:", clause);

      // DEMO: This is an example form for demonstration purposes
      // In a real implementation, this would call the document analysis API
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

      alert(
        "Demo form submitted successfully! This is for demonstration only."
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Example Clause Form</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Clause Type:</label>
          <input
            type="text"
            value={clause?.clause_type || ""}
            onChange={(e) =>
              setClause((prev) => ({ ...prev, clause_type: e.target.value }))
            }
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Risk Level:</label>
          <select
            value={clause?.risk_level || ""}
            onChange={(e) =>
              setClause((prev) => ({
                ...prev,
                risk_level: e.target.value as "high" | "medium" | "low",
              }))
            }
            className="w-full p-2 border border-gray-300 rounded"
          >
            <option value="">Select Risk Level</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Clause Text:</label>
          <textarea
            value={clause?.text || ""}
            onChange={(e) =>
              setClause((prev) => ({ ...prev, text: e.target.value }))
            }
            className="w-full p-2 border border-gray-300 rounded"
            rows={4}
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? "Submitting..." : "Submit Clause"}
        </button>
      </form>
    </div>
  );
}
