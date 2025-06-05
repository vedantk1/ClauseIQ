"use client";

import { useState } from "react";
import { Clause, ClauseType, RiskLevel } from "../../../shared/types/common";
import {
  validateClause,
  validateClauses,
  clauseSchema,
} from "../../../shared/types/validation";

interface ApiError {
  message: string;
  path?: string[];
}

export function ExampleClauseForm() {
  const [heading, setHeading] = useState("");
  const [text, setText] = useState("");
  const [clauseType, setClauseType] = useState<ClauseType>(ClauseType.GENERAL);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(RiskLevel.LOW);
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Clause | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Create a new clause object
    const newClause = {
      heading,
      text,
      clause_type: clauseType,
      risk_level: riskLevel,
    };

    try {
      // Validate client-side first using our shared validation
      const validationResult = clauseSchema.safeParse(newClause);

      if (!validationResult.success) {
        // Handle validation errors
        setErrors(
          validationResult.error.errors.map((err) => ({
            message: err.message,
            path: err.path,
          }))
        );
        return;
      }

      setIsSubmitting(true);

      // Send to API
      const response = await fetch("/api/v1/clauses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newClause),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // Validate the response from the API
      // This ensures the API returned data matching our shared type
      const validatedClause = validateClause(data);

      // Set the result
      setResult(validatedClause);

      // Reset the form
      setHeading("");
      setText("");
      setClauseType(ClauseType.GENERAL);
      setRiskLevel(RiskLevel.LOW);
    } catch (error) {
      console.error("Error submitting clause:", error);
      setErrors([{ message: (error as Error).message }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Clause</h1>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
          <strong>Please fix the following errors:</strong>
          <ul className="ml-4 mt-2 list-disc">
            {errors.map((error, index) => (
              <li key={index}>
                {error.path
                  ? `${error.path.join(".")}: ${error.message}`
                  : error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4">
          <strong>Clause created successfully!</strong>
          <div className="mt-2">
            <p>
              <strong>ID:</strong> {result.id}
            </p>
            <p>
              <strong>Heading:</strong> {result.heading}
            </p>
            <p>
              <strong>Type:</strong> {result.clause_type}
            </p>
            <p>
              <strong>Risk Level:</strong> {result.risk_level}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="heading" className="block font-medium mb-1">
            Heading
          </label>
          <input
            type="text"
            id="heading"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="text" className="block font-medium mb-1">
            Text
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-2 border rounded h-32"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="clauseType" className="block font-medium mb-1">
            Clause Type
          </label>
          <select
            id="clauseType"
            value={clauseType}
            onChange={(e) => setClauseType(e.target.value as ClauseType)}
            className="w-full p-2 border rounded"
          >
            {Object.values(ClauseType).map((type) => (
              <option key={type} value={type}>
                {type
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label htmlFor="riskLevel" className="block font-medium mb-1">
            Risk Level
          </label>
          <div className="flex gap-4">
            {Object.values(RiskLevel).map((level) => (
              <label key={level} className="flex items-center">
                <input
                  type="radio"
                  name="riskLevel"
                  value={level}
                  checked={riskLevel === level}
                  onChange={() => setRiskLevel(level)}
                  className="mr-2"
                />
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-4 py-2 rounded text-white ${
            isSubmitting ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isSubmitting ? "Creating..." : "Create Clause"}
        </button>
      </form>
    </div>
  );
}
