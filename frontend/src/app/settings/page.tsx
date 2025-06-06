"use client";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext.v2";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { toast } from "react-hot-toast";

export default function Settings() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const {
    user,
    preferences,
    availableModels,
    updatePreferences,
    updateProfile,
  } = useAuth();
  const [selectedModel, setSelectedModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Debug logging for availableModels
  React.useEffect(() => {
    console.log("[SETTINGS DEBUG] availableModels:", availableModels);
    console.log(
      "[SETTINGS DEBUG] availableModels length:",
      availableModels.length
    );
    console.log("[SETTINGS DEBUG] preferences:", preferences);
    console.log("[SETTINGS DEBUG] selectedModel:", selectedModel);
  }, [availableModels, preferences, selectedModel]);

  // Initialize selectedModel only once when preferences load
  React.useEffect(() => {
    if (preferences?.preferred_model && !hasInitialized) {
      setSelectedModel(preferences.preferred_model);
      setHasInitialized(true);
    } else if (
      !preferences?.preferred_model &&
      availableModels.length > 0 &&
      !hasInitialized
    ) {
      // If no preference is set, default to the first available model
      setSelectedModel(availableModels[0]?.id ?? "");
      setHasInitialized(true);
    }
  }, [preferences, availableModels, hasInitialized]);

  // Initialize fullName when user data loads
  React.useEffect(() => {
    if (user?.full_name !== undefined) {
      setFullName(user.full_name);
    }
  }, [user?.full_name]);

  const handleSaveProfile = async () => {
    console.log("handleSaveProfile called with fullName:", fullName);
    console.log("Current user full_name:", user?.full_name);

    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (fullName.trim() === user?.full_name) {
      toast.error("No changes to save");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      console.log("Calling updateProfile with:", fullName.trim());
      await updateProfile(fullName.trim());
      console.log("Profile update successful");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!selectedModel) {
      toast.error("Please select a model");
      return;
    }

    setIsSaving(true);
    try {
      await updatePreferences({ preferred_model: selectedModel });
    } catch (error) {
      console.error("Failed to update preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Auth loading check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary to-bg-secondary">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-text-primary mb-8">
            Settings
          </h1>

          {/* Profile Settings Section */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-6">
              Profile Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 bg-bg-primary border border-border-muted rounded-lg focus:ring-2 focus:ring-accent-purple focus:border-accent-purple outline-none transition-colors text-text-primary placeholder-text-muted"
                />
                <p className="text-xs text-text-secondary mt-1">
                  This name will be displayed throughout the application
                </p>
              </div>

              <div className="pt-4 border-t border-border-muted">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-text-secondary">
                      Current name:{" "}
                      <span className="font-medium text-text-primary">
                        {user?.full_name || "Not set"}
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    loading={isUpdatingProfile}
                    disabled={
                      !fullName.trim() || fullName.trim() === user?.full_name
                    }
                  >
                    {isUpdatingProfile ? "Updating..." : "Update Name"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-6">
              AI Model Preferences
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">
                  Preferred AI Model for Document Analysis
                </label>
                <div className="space-y-3">
                  {availableModels.map((model) => (
                    <div key={model.id} className="flex items-start space-x-3">
                      <input
                        type="radio"
                        id={model.id}
                        name="aiModel"
                        value={model.id}
                        checked={selectedModel === model.id}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="mt-1 h-4 w-4 text-accent-purple border-border-muted focus:ring-accent-purple focus:ring-2"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={model.id}
                          className="block text-sm font-medium text-text-primary cursor-pointer"
                        >
                          {model.name}
                        </label>
                        <p className="text-sm text-text-secondary mt-1">
                          {model.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border-muted">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-text-secondary">
                      Current selection:{" "}
                      <span className="font-medium text-text-primary">
                        {availableModels.find((m) => m.id === selectedModel)
                          ?.name || selectedModel}
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={handleSavePreferences}
                    loading={isSaving}
                    disabled={selectedModel === preferences?.preferred_model}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 mt-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              About AI Models
            </h2>
            <div className="space-y-3 text-sm text-text-secondary">
              <p>
                Different AI models have varying capabilities and performance
                characteristics:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>GPT-3.5 Turbo:</strong> Fast and cost-effective for
                  most document analysis tasks
                </li>
                <li>
                  <strong>GPT-4 Models:</strong> More advanced reasoning
                  capabilities for complex contract analysis
                </li>
                <li>
                  <strong>GPT-4o Models:</strong> Optimized versions with
                  improved speed and efficiency
                </li>
              </ul>
              <p className="pt-2">
                Your selection will be applied to all document analysis,
                including summaries and clause identification.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
