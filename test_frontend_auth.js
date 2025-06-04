#!/usr/bin/env node

// Test script to verify frontend authentication flow
const API_BASE_URL = "http://localhost:8000";

async function testFrontendAuth() {
  console.log("Testing frontend authentication flow...");

  // Step 1: Login
  console.log("\n1. Testing login...");
  try {
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "debug@test.com",
        password: "testpass123",
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${JSON.stringify(error)}`);
    }

    const loginData = await loginResponse.json();
    console.log("✅ Login successful");
    console.log(
      `   Access token: ${loginData.access_token.substring(0, 50)}...`
    );

    // Step 2: Verify /auth/me
    console.log("\n2. Testing /auth/me...");
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
      },
    });

    if (!meResponse.ok) {
      throw new Error(`/auth/me failed: ${meResponse.status}`);
    }

    const userData = await meResponse.json();
    console.log("✅ /auth/me successful");
    console.log(`   User: ${userData.full_name} (${userData.email})`);

    // Step 3: Test documents endpoint
    console.log("\n3. Testing /documents/...");
    const docsResponse = await fetch(`${API_BASE_URL}/documents/`, {
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!docsResponse.ok) {
      const error = await docsResponse.text();
      throw new Error(`Documents failed: ${docsResponse.status} - ${error}`);
    }

    const docsData = await docsResponse.json();
    console.log("✅ /documents/ successful");
    console.log(`   Documents found: ${docsData.documents?.length || 0}`);

    console.log("\n🎉 All authentication tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Use dynamic import for fetch if not available
if (typeof fetch === "undefined") {
  const { default: fetch } = await import("node-fetch");
  global.fetch = fetch;
}

testFrontendAuth();
