// Test script to verify user interactions API

const config = {
  apiUrl: "http://localhost:8000",
};

async function testUserInteractionsAPI() {
  const token = localStorage.getItem("authToken");
  const testDocumentId = "test-doc-123";

  console.log("🔍 Testing User Interactions API");
  console.log("API URL:", config.apiUrl);
  console.log("Test Document ID:", testDocumentId);
  console.log("Auth Token:", token ? "Present" : "Missing");

  const headers = {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };

  try {
    console.log(
      "\n📡 Testing GET /api/v1/analysis/documents/{doc_id}/interactions"
    );
    const response = await fetch(
      `${config.apiUrl}/api/v1/analysis/documents/${testDocumentId}/interactions`,
      {
        method: "GET",
        headers,
      }
    );

    console.log("Response Status:", response.status);
    console.log(
      "Response Headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("Response Body:", responseText);

    if (!response.ok) {
      console.error("❌ API call failed");
      console.error("Status:", response.status, response.statusText);
    } else {
      console.log("✅ API call successful");
      try {
        const data = JSON.parse(responseText);
        console.log("Parsed Data:", data);
      } catch (e) {
        console.log("Could not parse response as JSON");
      }
    }
  } catch (error) {
    console.error("❌ Network error:", error);
  }
}

// Test when page loads
window.addEventListener("load", () => {
  setTimeout(testUserInteractionsAPI, 1000);
});

console.log("✅ User Interactions API test script loaded");
