"use client";
import React, { useState, useEffect, useRef } from "react";
import Button from "@/components/Button";
import toast from "react-hot-toast";
import { documentChatApi } from "@/lib/documentChatApiClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
  model_used?: string; // Add model info to the interface
}

interface ChatSession {
  session_id: string;
  document_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

interface DocumentChatProps {
  documentId: string;
  className?: string;
}

export default function DocumentChat({
  documentId,
  className = "",
}: DocumentChatProps) {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  // const [isLoading, setIsLoading] = useState(false); // 🚀 Not needed in foundational architecture
  const [isSending, setIsSending] = useState(false);
  const [chatStatus, setChatStatus] = useState<{
    chat_available: boolean;
    rag_processed: boolean;
    ready_for_chat: boolean;
    processing_status: string;
    chunk_count: number;
    text_length: number;
    error?: string;
  } | null>(null);

  // State no longer needed - direct delete without confirmation
  // const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check chat status when component mounts - force reload
  useEffect(() => {
    const fetchChatStatus = async () => {
      try {
        const response = await documentChatApi.get(`/${documentId}/status`);
        if (response.ok) {
          const result = (await response.json()) as { data: unknown };
          console.log("Check status button - response:", result);
          setChatStatus(result.data as typeof chatStatus);
        } else {
          console.error(
            "Check status button - failed:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error("Error checking chat status:", error);
      }
    };

    fetchChatStatus();
  }, [documentId]);

  // 🚀 FOUNDATIONAL ARCHITECTURE: Initialize THE session automatically
  useEffect(() => {
    const initializeFoundationalSession = async () => {
      if (!chatStatus?.chat_available || !chatStatus?.ready_for_chat) {
        return; // Wait for chat to be ready
      }

      console.log(
        "🎯 [Foundational] Initializing session for document:",
        documentId
      );

      try {
        const sessionResponse = await documentChatApi.getOrCreateSession(
          documentId
        );

        if (sessionResponse.ok) {
          const sessionResult = (await sessionResponse.json()) as {
            data: {
              session_id: string;
              document_id: string;
              messages: ChatMessage[];
              created_at: string;
              updated_at: string;
            };
          };

          console.log("🔍 DEBUG Session Result:", {
            sessionId: sessionResult.data.session_id,
            hasMessages: Array.isArray(sessionResult.data.messages),
            messagesCount: Array.isArray(sessionResult.data.messages)
              ? sessionResult.data.messages.length
              : "undefined",
            fullData: sessionResult.data,
          });

          const foundationalSession: ChatSession = {
            session_id: sessionResult.data.session_id,
            document_id: sessionResult.data.document_id,
            messages: Array.isArray(sessionResult.data.messages)
              ? sessionResult.data.messages
              : [],
            created_at: sessionResult.data.created_at,
            updated_at: sessionResult.data.updated_at,
          };

          console.log("✅ [Foundational] THE session initialized:", {
            sessionId: foundationalSession.session_id,
            messageCount: foundationalSession.messages.length,
          });

          setCurrentSession(foundationalSession);
          setMessages(foundationalSession.messages);
        } else {
          console.error(
            "❌ [Foundational] Failed to initialize session:",
            sessionResponse.statusText
          );
        }
      } catch (error) {
        console.error("💥 [Foundational] Session initialization error:", error);
      }
    };

    initializeFoundationalSession();
  }, [documentId, chatStatus?.chat_available, chatStatus?.ready_for_chat]);

  const checkChatStatus = async () => {
    try {
      const response = await documentChatApi.get(`/${documentId}/status`);

      if (response.ok) {
        const result = (await response.json()) as { data: unknown };
        console.log("Chat status response:", result);
        console.log("Setting chat status to:", result.data);
        setChatStatus(result.data as typeof chatStatus);
      } else {
        console.error(
          "Failed to check chat status",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error checking chat status:", error);
    }
  };

  // 🚀 FOUNDATIONAL LEGACY: Old session creation (not used in foundational architecture)
  // const createChatSession = async () => {
  //   // This method is preserved for backward compatibility but not used
  //   // in foundational architecture since sessions are auto-initialized
  //   console.log("⚠️ Legacy createChatSession called - foundational architecture handles this automatically");
  // };

  // 🚀 FOUNDATIONAL SEND MESSAGE - Clean and Simple!
  const sendMessageFoundational = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    console.log("🚀 [Foundational] Sending message:", {
      message: userMessage.content,
      documentId: documentId,
    });

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsSending(true);

    try {
      const response = await documentChatApi.sendMessageFoundational(
        documentId,
        userMessage.content
      );

      console.log("📥 [Foundational] Response received:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok) {
        const result = (await response.json()) as {
          data: { message: ChatMessage; session_id: string };
        };
        const aiMessage: ChatMessage = result.data.message;

        console.log("🤖 [Foundational] AI Response:", {
          content: aiMessage.content.substring(0, 100) + "...",
          hasSources: !!aiMessage.sources && aiMessage.sources.length > 0,
          sourceCount: aiMessage.sources?.length || 0,
          timestamp: aiMessage.timestamp,
          modelUsed: aiMessage.model_used || "unknown",
        });

        // Prominent model logging
        if (aiMessage.model_used) {
          console.log(
            `🎯 [AI MODEL] Chat response generated using: ${aiMessage.model_used}`
          );
        }

        if (aiMessage.sources && aiMessage.sources.length > 0) {
          console.log("📚 [Foundational] Sources found:", aiMessage.sources);
        }

        setMessages((prev) => [...prev, aiMessage]);
      } else {
        const error = (await response.json()) as {
          detail?: { message?: string };
        };
        console.error("❌ [Foundational] Message failed:", {
          status: response.status,
          error: error.detail?.message,
        });
        toast.error(error.detail?.message || "Failed to send message");
        // Remove the user message if sending failed
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (error) {
      console.error("💥 [Foundational] Network error:", error);
      toast.error("Failed to send message");
      // Remove the user message if sending failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
      console.log("✅ [Foundational] Message sending completed");
    }
  };

  // 🚀 FOUNDATIONAL LEGACY: Old message sending (preserved for reference)
  // const sendMessage = async () => {
  //   // This method is preserved for backward compatibility but not used
  //   // in foundational architecture - use sendMessageFoundational instead
  //   console.log("⚠️ Legacy sendMessage called - use sendMessageFoundational for foundational architecture");
  // };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessageFoundational(); // 🚀 Use foundational architecture!
    }
  };

  // Clear chat history
  const clearChatHistory = async () => {
    if (!currentSession) {
      console.warn("⚠️ [DocumentChat] No session to clear");
      return;
    }

    try {
      console.log("🗑️ [DocumentChat] Clearing chat history...");
      const response = await documentChatApi.clearChatHistory(documentId);

      if (response.ok) {
        const result = (await response.json()) as {
          data: { messages_cleared?: number };
        };
        console.log("✅ [DocumentChat] Chat history cleared:", result);

        // Clear local messages
        setMessages([]);

        toast.success(
          `Chat history cleared (${
            result.data?.messages_cleared || 0
          } messages removed)`
        );
      } else {
        throw new Error("Failed to clear chat history");
      }
    } catch (error) {
      console.error("💥 [DocumentChat] Clear history error:", error);
      toast.error("Failed to clear chat history. Please try again.");
    }
  };

  // If chat is not available
  // console.log("Chat status check:", {
  //   chatStatus,
  //   chat_available: chatStatus?.chat_available,
  //   ready_for_chat: chatStatus?.ready_for_chat,
  //   condition1: !chatStatus?.chat_available,
  //   condition2: !chatStatus?.ready_for_chat,
  //   overall: !chatStatus?.chat_available || !chatStatus?.ready_for_chat,
  // });

  if (!chatStatus?.chat_available || !chatStatus?.ready_for_chat) {
    const isProcessing =
      chatStatus?.processing_status &&
      !["ready", "rag_processed"].includes(chatStatus.processing_status);
    const hasError = chatStatus?.error;

    return (
      <div className={`space-y-3 ${className}`}>
        <div className="bg-bg-elevated rounded-lg p-3 min-h-96">
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 text-text-secondary mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-text-secondary mb-4">
              {hasError
                ? "Document processing failed"
                : isProcessing
                ? "Document is being processed for chat..."
                : "Chat service is currently unavailable"}
            </p>
            <p className="text-sm text-text-secondary">
              {hasError
                ? `Error: ${chatStatus.error}`
                : isProcessing
                ? `Status: ${chatStatus.processing_status}. Please wait a moment for the document to be prepared for interactive questions.`
                : "Please try again later or contact support if this issue persists."}
            </p>
            {(isProcessing || hasError) && (
              <Button
                onClick={checkChatStatus}
                className="mt-4"
                variant="secondary"
              >
                Check Status
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 🚀 FOUNDATIONAL ARCHITECTURE: No session creation UI needed!
  // THE session is automatically initialized when chat is ready.
  if (!currentSession) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="bg-bg-elevated rounded-lg p-3 min-h-96">
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 text-accent-purple mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              🚀 Initializing Your Document Chat
            </h3>
            <p className="text-text-secondary mb-4">
              Setting up your conversation session... The foundational
              architecture is automatically preparing THE session for this
              document.
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple mx-auto"></div>
            <p className="text-xs text-text-tertiary mt-4">
              Processed {chatStatus?.chunk_count || 0} document sections for
              intelligent search
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active chat interface
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages container with tiny clear button overlay */}
      <div
        ref={messagesContainerRef}
        className="bg-bg-elevated rounded-lg p-3 flex-1 overflow-y-auto min-h-0 relative"
      >
        {/* Tiny clear button - top-left overlay, direct delete without confirmation */}
        {messages.length > 0 && (
          <button
            onClick={clearChatHistory}
            className="sticky top-2 left-2 z-10 w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-text-secondary bg-bg-surface/80 hover:bg-bg-surface/90 border border-border-muted/30 hover:border-border-muted rounded transition-all duration-200"
            title="Clear chat history"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-secondary mb-2">
                Welcome to your document chat session!
              </p>
              <p className="text-sm text-text-tertiary">
                Ask questions like &ldquo;What are the termination
                conditions?&rdquo; or &ldquo;What happens if I want to
                quit?&rdquo;
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    message.role === "user"
                      ? "bg-accent-purple text-white"
                      : "bg-bg-surface border border-border-muted text-text-primary"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                  {message.role === "assistant" && (
                    <p className="text-xs text-text-tertiary opacity-70 mt-1.5 text-right">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-bg-surface border border-border-muted rounded-lg px-3 py-2 max-w-[85%]">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-purple"></div>
                  <p className="text-sm text-text-secondary">
                    AI is thinking...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area - fixed at bottom */}
      <div className="flex gap-2 mt-4 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask a question about your contract..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSending}
          className="flex-1 px-3 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent-purple focus:border-transparent disabled:opacity-50"
        />
        <Button
          onClick={sendMessageFoundational} // 🚀 Use foundational architecture!
          disabled={!inputMessage.trim() || isSending}
        >
          {isSending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
