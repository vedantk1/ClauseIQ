"use client";
import { useAuth } from "@/context/AuthContext";
import { useApiCall } from "@/lib/apiUtils";
import { useEffect, useState } from "react";

// Define proper interface for documents response
interface DocumentsResponse {
  documents?: Array<{
    id: string;
    filename: string;
    upload_date: string;
  }>;
  error?: string;
}

export default function AuthDebugPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const apiCall = useApiCall();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentsResponse | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const addDebugInfo = (message: string) => {
    if (typeof window !== "undefined") {
      console.log(message);
      setDebugInfo((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString()}: ${message}`,
      ]);
    }
  };

  useEffect(() => {
    if (isMounted) {
      addDebugInfo(
        `Auth state - isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, user: ${
          user?.email || "null"
        }`
      );
    }
  }, [isLoading, isAuthenticated, user, isMounted]);

  if (!isMounted) {
    return <div>Loading...</div>;
  }

  const testDirectLogin = async () => {
    addDebugInfo("Testing direct login...");
    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "debug@test.com",
          password: "testpass123",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          addDebugInfo("✅ Direct login successful, tokens stored");
          window.location.reload(); // Reload to trigger auth context
        }
      } else {
        addDebugInfo("❌ Direct login failed");
      }
    } catch (error) {
      addDebugInfo(`❌ Login error: ${error}`);
    }
  };

  const testDocuments = async () => {
    addDebugInfo("Testing documents API...");
    try {
      const response = await apiCall("/documents/");
      addDebugInfo(`Documents API response status: ${response.status}`);

      if (response.ok) {
        const data = (await response.json()) as DocumentsResponse;
        setDocuments(data);
        addDebugInfo(`✅ Documents loaded: ${JSON.stringify(data)}`);
      } else {
        const errorText = await response.text();
        addDebugInfo(`❌ Documents API failed: ${errorText}`);
      }
    } catch (error) {
      addDebugInfo(`❌ Documents API error: ${error}`);
    }
  };

  const clearTokens = () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      addDebugInfo("🧹 Cleared localStorage");
      window.location.reload();
    }
  };

  // Helper function to safely access localStorage
  const getStorageItem = (key: string): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>ClauseIQ Authentication Debug</h1>

      <div style={{ marginBottom: "20px" }}>
        <h2>Current State</h2>
        <p>Loading: {isLoading ? "Yes" : "No"}</p>
        <p>Authenticated: {isAuthenticated ? "Yes" : "No"}</p>
        <p>User: {user ? `${user.full_name} (${user.email})` : "None"}</p>
        <p>
          Access Token: {getStorageItem("access_token") ? "Present" : "Missing"}
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={testDirectLogin}
          style={{ margin: "5px", padding: "10px" }}
        >
          Login Directly
        </button>
        <button
          onClick={testDocuments}
          style={{ margin: "5px", padding: "10px" }}
        >
          Test Documents API
        </button>
        <button
          onClick={clearTokens}
          style={{ margin: "5px", padding: "10px" }}
        >
          Clear Tokens
        </button>
      </div>

      {documents && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Documents Data:</h3>
          <pre
            style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}
          >
            {JSON.stringify(documents, null, 2)}
          </pre>
        </div>
      )}

      <div>
        <h3>Debug Log:</h3>
        <div
          style={{
            background: "#f5f5f5",
            padding: "10px",
            height: "300px",
            overflow: "auto",
          }}
        >
          {debugInfo.map((info, index) => (
            <div key={index}>{info}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
