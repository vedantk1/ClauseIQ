"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalysisTrendChartProps {
  monthlyStats: Array<{
    month: string;
    documents: number;
    risks: number;
  }>;
  showDocuments: boolean;
  showRisks: boolean;
}

export const AnalysisTrendChart: React.FC<AnalysisTrendChartProps> = ({
  monthlyStats,
  showDocuments,
  showRisks,
}) => {
  const data = {
    labels: monthlyStats.map((stat) => stat.month),
    datasets: [
      ...(showDocuments
        ? [
            {
              label: "Documents",
              data: monthlyStats.map((stat) => stat.documents),
              borderColor: "rgb(147, 51, 234)", // accent-purple
              backgroundColor: "rgba(147, 51, 234, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "rgb(147, 51, 234)",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ]
        : []),
      ...(showRisks
        ? [
            {
              label: "Risks",
              data: monthlyStats.map((stat) => stat.risks),
              borderColor: "rgb(239, 68, 68)", // status-error
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "rgb(239, 68, 68)",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ]
        : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We'll handle legend with custom toggles
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "rgb(255, 255, 255)",
        bodyColor: "rgb(255, 255, 255)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
          borderColor: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "rgb(156, 163, 175)", // text-gray-400
          font: {
            size: 12,
          },
        },
      },
      y: {
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
          borderColor: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "rgb(156, 163, 175)", // text-gray-400
          font: {
            size: 12,
          },
          callback: function (value: any) {
            return value;
          },
        },
        beginAtZero: true,
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  // If no data to show, display empty state
  if (!showDocuments && !showRisks) {
    return (
      <div className="h-64 bg-surface-secondary rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-secondary flex items-center justify-center">
            <svg className="w-6 h-6 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-text-tertiary text-sm">Select metrics to view trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <Line data={data} options={options} />
    </div>
  );
}; 