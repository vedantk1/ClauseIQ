#!/usr/bin/env node
import fetch from "node-fetch";

const API_BASE_URL = "http://localhost:8000";

async function testClauseIQDocs() {
  console.log("🔍 Testing ClauseIQ user documents endpoint...");
  
  try {
    // Login as clauseiq@gmail.com
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "clauseiq@gmail.com", 
        password: "testpass123"
      })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      console.error("❌ Login failed:", loginResponse.status, error);
      return;
    }
    
    const { access_token } = await loginResponse.json();
    console.log("✅ Login successful for clauseiq@gmail.com");
    
    // Test /documents/ endpoint
    const docsResponse = await fetch(`${API_BASE_URL}/documents/`, {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      }
    });
    
    console.log("📄 Documents response status:", docsResponse.status);
    
    if (!docsResponse.ok) {
      const error = await docsResponse.text();
      console.error("❌ Documents endpoint failed:", error);
      return;
    }
    
    const docs = await docsResponse.json();
    console.log("✅ Documents endpoint successful");
    console.log("📊 Document count:", docs.documents.length);
    
    if (docs.documents.length > 0) {
      console.log("📝 Sample documents:");
      docs.documents.slice(0, 3).forEach((doc, i) => {
        console.log(`  ${i+1}. ${doc.filename} (ID: ${doc.id.substring(0, 8)}...)`);
        console.log(`     Upload: ${doc.upload_date}`);
        console.log(`     Sections: ${doc.sections.length}`);
      });
    } else {
      console.log("📭 No documents found");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testClauseIQDocs();
