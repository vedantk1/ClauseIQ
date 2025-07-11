"use client";
import React from "react";
import Button from "./Button";

interface SidebarTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  content?: React.ReactNode;
}

interface ReviewSidebarProps {
  activeTab: string | null;
  onTabChange: (tabId: string | null) => void;
  tabs: SidebarTab[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onExpandAndSelectTab?: (tabId: string) => void;
  className?: string;
}

export default function ReviewSidebar({
  activeTab,
  onTabChange,
  tabs,
  isCollapsed,
  onToggleCollapse,
  onExpandAndSelectTab,
  className = "",
}: ReviewSidebarProps) {
  const handleTabClick = (tabId: string) => {
    if (isCollapsed) {
      // When collapsed, expand and select the tab
      if (onExpandAndSelectTab) {
        onExpandAndSelectTab(tabId);
      }
    } else {
      // When expanded, just switch to the clicked tab
      onTabChange(tabId);
    }
  };

  const handleBackToDocuments = () => {
    window.open("/documents", "_blank");
  };

  return (
    <div className={`flex h-full ${className}`}>
      {/* Tab Icons Column - Fixed width */}
      <div className="w-16 bg-bg-secondary border-r border-border-light flex flex-col flex-shrink-0">
        {/* Back to Documents Button */}
        <div className="p-3 border-b border-border-light">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToDocuments}
            className="w-full p-2"
            aria-label="Back to Documents"
            title="Back to Documents"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 22V12h6v10"
              />
            </svg>
          </Button>
        </div>

        {/* Tab Icons */}
        <div className="flex-1 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full p-3 flex items-center justify-center rounded-lg mx-2 mb-2 transition-colors ${
                activeTab === tab.id
                  ? "bg-accent-purple/10 text-accent-purple"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`}
              title={tab.label}
              aria-label={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Content Panel - Let parent control width */}
      {!isCollapsed && activeTab && (
        <div className="flex-1 bg-bg-primary border-r border-border-light flex flex-col min-w-0">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between p-3 border-b border-border-light bg-bg-secondary">
            <h3 className="text-base font-medium text-text-primary">
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="p-1"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </Button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {tabs.find((tab) => tab.id === activeTab)?.content}
          </div>
        </div>
      )}
    </div>
  );
}
