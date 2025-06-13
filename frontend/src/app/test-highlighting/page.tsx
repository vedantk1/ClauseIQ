"use client";
import React from "react";
import {
  highlightLegalTokens,
  highlightTextWithTokensAndSearch,
} from "@/components/review/clauseUtils";

const TEST_CLAUSES = [
  {
    id: "1",
    heading: "Compensation",
    text: "The Company shall pay Employee a base salary of $120,000 per year, payable in bi-weekly installments. Employee shall also be eligible for performance bonuses at the Company's discretion.",
    clause_type: "compensation",
    risk_level: "medium" as const,
    summary: "Annual salary of $120,000 with potential performance bonuses",
  },
  {
    id: "2",
    heading: "Termination",
    text: "Either party may terminate this agreement at any time with or without cause by providing 30 days written notice. Upon termination, Employee shall return all Company property.",
    clause_type: "termination",
    risk_level: "low" as const,
    summary: "30-day notice required for termination",
  },
  {
    id: "3",
    heading: "Non-Compete Agreement",
    text: "Employee agrees that for a period of 24 months following termination of employment, Employee shall not directly or indirectly engage in any business that competes with the Company within a 100-mile radius of the Company's headquarters.",
    clause_type: "non_compete",
    risk_level: "high" as const,
    summary: "24-month non-compete within 100-mile radius",
  },
  {
    id: "4",
    heading: "Benefits",
    text: "Employee shall be entitled to health insurance, dental insurance, and 401(k) participation as provided in the Company's employee handbook. The company matches up to 5% of salary contributions.",
    clause_type: "benefits",
    risk_level: "low" as const,
    summary: "Standard benefits package with 5% 401(k) match",
  },
  {
    id: "5",
    heading: "Financial Terms",
    text: "Late payments will incur interest at a rate of 1.5% per month or 18% per annum. Payment terms are Net 30 days from invoice date. A deposit of £5,000.00 is required upfront, with the remaining balance of €15,000 due in 60 business days.",
    clause_type: "payment_terms",
    risk_level: "medium" as const,
    summary: "Complex payment terms with multiple currencies and deadlines",
  },
];

export default function TestHighlightingPage() {
  const [searchQuery, setSearchQuery] = React.useState("");

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Legal Token Highlighting Demo
          </h1>
          <p className="text-gray-600 mb-6">
            This demo showcases automatic highlighting of critical legal tokens
            including:
            <strong>
              {" "}
              money amounts, time periods, percentages, and deadlines
            </strong>
            . The highlighting works in combination with search functionality.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search (try &quot;30&quot;, &quot;salary&quot;, or
              &quot;$120&quot;)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search clause text..."
            />
          </div>
        </div>

        <div className="grid gap-6">
          {TEST_CLAUSES.map((clause) => (
            <div
              key={clause.id}
              className="bg-white rounded-lg shadow-md p-6 border"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {clause.heading}
                </h3>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    clause.risk_level === "high"
                      ? "bg-red-100 text-red-800"
                      : clause.risk_level === "medium"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {clause.risk_level.charAt(0).toUpperCase() +
                    clause.risk_level.slice(1)}{" "}
                  Risk
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Without Token Highlighting:
                </h4>
                <p className="text-gray-700 p-3 bg-gray-50 rounded border">
                  {clause.text}
                </p>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  With Token Highlighting Only:
                </h4>
                <p className="text-gray-700 p-3 bg-blue-50 rounded border">
                  {highlightLegalTokens(clause.text)}
                </p>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  With Combined Token + Search Highlighting:
                </h4>
                <p className="text-gray-700 p-3 bg-purple-50 rounded border">
                  {highlightTextWithTokensAndSearch(clause.text, searchQuery)}
                </p>
              </div>

              <div className="mt-4 p-3 bg-gray-100 rounded">
                <h5 className="text-xs font-medium text-gray-600 mb-1">
                  Summary:
                </h5>
                <p className="text-sm text-gray-700">{clause.summary}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Token Highlighting Legend
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600">$120,000</span>
              <span className="text-gray-700">Money amounts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-600">30 days</span>
              <span className="text-gray-700">Time periods</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-600">1.5%</span>
              <span className="text-gray-700">Percentages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-600">24 months</span>
              <span className="text-gray-700">Duration ranges</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600">£5,000.00</span>
              <span className="text-gray-700">Multi-currency</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600">per annum</span>
              <span className="text-gray-700">Financial terms</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            This enhanced highlighting improves legal document review speed by
            automatically identifying critical terms.
          </p>
        </div>
      </div>
    </div>
  );
}
