#!/usr/bin/env node

// Complete frontend authentication test
const { execSync } = require("child_process");

async function runCompleteTest() {
  console.log("🚀 Starting complete frontend authentication test...\n");

  // Step 1: Login and get tokens via backend
  console.log("1️⃣ Getting authentication tokens from backend...");
  try {
    const loginResult = execSync(`
            curl -s -X POST -H "Content-Type: application/json" \\
            -d '{"email":"debug@test.com","password":"testpass123"}' \\
            http://localhost:8000/auth/login
        `).toString();

    const loginData = JSON.parse(loginResult);
    console.log("✅ Login successful");
    console.log(
      `   Access token: ${loginData.access_token.substring(0, 50)}...`
    );

    // Step 2: Test documents endpoint directly
    console.log("\n2️⃣ Testing documents endpoint with token...");
    const docsResult = execSync(`
            curl -s -H "Authorization: Bearer ${loginData.access_token}" \\
            http://localhost:8000/documents/
        `).toString();

    const docsData = JSON.parse(docsResult);
    console.log("✅ Documents endpoint successful");
    console.log(`   Documents: ${JSON.stringify(docsData)}`);

    // Step 3: Create an HTML page that sets tokens and redirects
    console.log("\n3️⃣ Creating test page with authentication...");
    const testPageContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Test Setup</title>
</head>
<body>
    <h1>Setting up authentication...</h1>
    <div id="status">Initializing...</div>
    
    <script>
        const accessToken = "${loginData.access_token}";
        const refreshToken = "${loginData.refresh_token}";
        
        // Set tokens in localStorage
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        
        document.getElementById('status').innerHTML = 
            "✅ Tokens set! Click to visit history page: <br><br>" +
            "<a href='http://localhost:3000/history' target='_blank' style='padding: 10px 20px; background: #007cba; color: white; text-decoration: none; border-radius: 5px;'>Open History Page</a>";
        
        console.log("Tokens set in localStorage:");
        console.log("Access token:", !!accessToken);
        console.log("Refresh token:", !!refreshToken);
    </script>
</body>
</html>`;

    require("fs").writeFileSync(
      "/Users/vedan/Downloads/clauseiq-project/auth_test_page.html",
      testPageContent
    );
    console.log("✅ Test page created at auth_test_page.html");

    console.log(
      "\n🎯 Now open the auth_test_page.html in a browser and click the link to test the history page!"
    );
    console.log(
      "   file:///Users/vedan/Downloads/clauseiq-project/auth_test_page.html"
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

runCompleteTest();
