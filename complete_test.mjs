#!/usr/bin/env node

// Complete test of the frontend authentication issue
import fetch from "node-fetch";

const API_BASE_URL = "http://localhost:8000";
const FRONTEND_URL = "http://localhost:3000";

async function testCompleteFlow() {
  console.log("🧪 Testing complete authentication flow for ClauseIQ\n");

  try {
    // Step 1: Test backend is running
    console.log("1️⃣  Testing backend availability...");
    const healthResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: "Bearer invalid" },
    });
    if (healthResponse.status === 401) {
      console.log("✅ Backend is running and rejecting invalid tokens");
    } else {
      throw new Error(`Unexpected backend response: ${healthResponse.status}`);
    }

    // Step 2: Login and get tokens
    console.log("\n2️⃣  Testing login...");
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "clauseiq@gmail.com",
        password: "testuser123",
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${JSON.stringify(error)}`);
    }

    const { access_token, refresh_token } = await loginResponse.json();
    console.log("✅ Login successful");
    console.log(`   Access token: ${access_token.substring(0, 50)}...`);

    // Step 3: Test /auth/me
    console.log("\n3️⃣  Testing /auth/me...");
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!meResponse.ok) {
      throw new Error(`/auth/me failed: ${meResponse.status}`);
    }

    const user = await meResponse.json();
    console.log("✅ /auth/me successful");
    console.log(`   User: ${user.full_name} (${user.email})`);

    // Step 4: Test documents endpoint
    console.log("\n4️⃣  Testing /documents/...");
    const docsResponse = await fetch(`${API_BASE_URL}/documents/`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!docsResponse.ok) {
      const error = await docsResponse.text();
      throw new Error(`Documents failed: ${docsResponse.status} - ${error}`);
    }

    const docs = await docsResponse.json();
    console.log("✅ /documents/ successful");
    console.log(`   Documents: ${JSON.stringify(docs)}`);

    // Step 5: Test frontend accessibility
    console.log("\n5️⃣  Testing frontend accessibility...");
    const frontendResponse = await fetch(`${FRONTEND_URL}/`, {
      method: "HEAD",
    });

    if (frontendResponse.ok) {
      console.log("✅ Frontend is accessible");
    } else {
      throw new Error(`Frontend not accessible: ${frontendResponse.status}`);
    }

    console.log("\n🎉 All backend tests PASSED!");
    console.log("\n📋 Summary:");
    console.log("   ✓ Backend authentication working");
    console.log("   ✓ Document API working");
    console.log("   ✓ Frontend server running");
    console.log("\n🔍 Next Steps:");
    console.log("   1. Open browser to: http://localhost:3000/debug");
    console.log("   2. Click 'Login Directly' to set tokens");
    console.log("   3. Click 'Test Documents API' to verify");
    console.log("   4. Visit: http://localhost:3000/history");

    console.log(
      "\n💡 If history page fails, check browser console for debug logs"
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testCompleteFlow();
