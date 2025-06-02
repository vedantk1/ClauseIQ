export default function About() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">About Legal-AI</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4">
        <section>
          <h2 className="text-lg font-medium mb-2">What is Legal-AI?</h2>
          <p>
            Legal-AI is a tool designed to help non-lawyers understand
            employment contracts by extracting important information and
            providing simple explanations. It uses natural language processing
            to analyze legal documents and present key points in plain language.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-2">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Upload your employment contract PDF</li>
            <li>Our system extracts and processes the text</li>
            <li>The document is split into logical sections</li>
            <li>Each section is analyzed and summarized</li>
            <li>Results are presented in an easy-to-understand format</li>
          </ol>
        </section>

        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mt-6 dark:bg-amber-900/20 dark:border-amber-700">
          <h3 className="text-amber-800 dark:text-amber-500 font-medium">
            Legal Disclaimer
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            This tool is provided for informational purposes only and does not
            constitute legal advice. Always consult with a qualified legal
            professional before making decisions based on contract analysis. Our
            AI-based system attempts to highlight important clauses but may miss
            critical details or misinterpret complex legal language.
          </p>
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-500 text-center">
        &copy; 2025 Legal-AI Project • All Rights Reserved
      </div>
    </div>
  );
}
