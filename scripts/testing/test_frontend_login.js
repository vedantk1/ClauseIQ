// Test frontend login functionality
async function testFrontendLogin() {
  console.log("🧪 Testing frontend login functionality...");

  try {
    // Wait for the page to be fully loaded
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find the email input field
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const submitButton = document.querySelector('button[type="submit"]');

    console.log("📍 Form elements found:", {
      emailInput: !!emailInput,
      passwordInput: !!passwordInput,
      submitButton: !!submitButton,
    });

    if (!emailInput || !passwordInput || !submitButton) {
      console.error("❌ Missing form elements");
      return;
    }

    // Fill in the credentials
    emailInput.value = "clauseiq@gmail.com";
    passwordInput.value = "testuser123";

    // Trigger input events
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    emailInput.dispatchEvent(new Event("change", { bubbles: true }));
    passwordInput.dispatchEvent(new Event("change", { bubbles: true }));

    console.log("✅ Credentials filled in");
    console.log("📤 Submitting form...");

    // Submit the form
    submitButton.click();

    console.log("🔄 Form submitted, waiting for response...");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Auto-run when script loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", testFrontendLogin);
} else {
  testFrontendLogin();
}
