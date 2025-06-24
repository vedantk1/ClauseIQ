#!/usr/bin/env node

/**
 * Test script to simulate frontend CORS issues
 * This replicates the exact calls the frontend makes
 */

// First login to get a real token
async function loginAndGetToken() {
  const baseUrl = "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: "clauseiq@gmail.com",
        password: "testuser123",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Login successful!");
      return data.data.access_token;
    } else {
      console.log("❌ Login failed:", response.status);
      return null;
    }
  } catch (error) {
    console.error("❌ Login error:", error);
    return null;
  }
}

// Simulate frontend making requests like in DocumentChat.tsx
async function testFrontendCorsIssue() {
  console.log("🔍 Testing Frontend CORS Issue Simulation");

  const baseUrl = "http://localhost:8000";
  const documentId = "4c842617-d7e6-4648-948b-d02f79f0e18f"; // Real document ID from logs

  // Get a real token first
  console.log("🔐 Getting authentication token...");
  const realToken = await loginAndGetToken();

  if (!realToken) {
    console.log(
      "❌ Could not get authentication token, testing with fake token"
    );
  }

  const token = realToken || "fake-or-expired-token";

  const headers = {
    Origin: "http://localhost:3000",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const endpoints = [
    `/api/v1/chat/${documentId}/chat/status`,
    `/api/v1/chat/${documentId}/history`,
    `/api/v1/chat/${documentId}/session`,
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing ${endpoint}`);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers: headers,
      });

      console.log(`Status: ${response.status}`);
      console.log("Headers:", Object.fromEntries(response.headers.entries()));

      const corsOrigin = response.headers.get("access-control-allow-origin");
      const corsCredentials = response.headers.get(
        "access-control-allow-credentials"
      );

      if (corsOrigin) {
        console.log(`✅ CORS Origin: ${corsOrigin}`);
      } else {
        console.log(`❌ Missing CORS Origin header`);
      }

      if (corsCredentials) {
        console.log(`✅ CORS Credentials: ${corsCredentials}`);
      } else {
        console.log(`❌ Missing CORS Credentials header`);
      }

      const text = await response.text();
      console.log(`Response: ${text.substring(0, 200)}...`);
    } catch (error) {
      console.error(`❌ Network error: ${error.message}`);
    }
  }

  // Test POST to session endpoint like frontend does
  console.log(`\n📡 Testing POST ${endpoints[2]}`);
  try {
    const response = await fetch(`${baseUrl}${endpoints[2]}`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({}),
    });

    console.log(`Status: ${response.status}`);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));

    const corsOrigin = response.headers.get("access-control-allow-origin");
    if (corsOrigin) {
      console.log(`✅ CORS Origin: ${corsOrigin}`);
    } else {
      console.log(`❌ Missing CORS Origin header`);
    }

    const text = await response.text();
    console.log(`Response: ${text.substring(0, 200)}...`);
  } catch (error) {
    console.error(`❌ Network error: ${error.message}`);
  }

  // Test a real message send
  console.log(`\n📡 Testing POST message to ${documentId}`);
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/chat/${documentId}/message`,
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          message: "Hello, can you help me understand this document?",
        }),
      }
    );

    console.log(`Status: ${response.status}`);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));

    const corsOrigin = response.headers.get("access-control-allow-origin");
    if (corsOrigin) {
      console.log(`✅ CORS Origin: ${corsOrigin}`);
    } else {
      console.log(`❌ Missing CORS Origin header`);
    }

    const text = await response.text();
    console.log(`Response: ${text.substring(0, 400)}...`);
  } catch (error) {
    console.error(`❌ Network error: ${error.message}`);
  }
}

// Run the test
testFrontendCorsIssue().catch(console.error);
