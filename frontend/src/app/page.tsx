"use client";

import { useCallback, useState, useEffect } from "react";
import { UploadZone } from "./components/UploadZone";
import { AnalysisResult } from "./components/AnalysisResult";
import { useWebSocket } from "./components/useWebSocket";
import { StreamOutput } from "./components/StreamOutput";
import { HistoryPanel } from "./components/HistoryPanel";

export interface SkillAnalysisResult {
  overall_score: number;
  dimensions: {
    clarity: number;
    completeness: number;
    correctness: number;
    usability: number;
    documentation: number;
  };
  issues: Array<{
    severity: "error" | "warning" | "info";
    file: string;
    message: string;
  }>;
  suggestions: string[];
  summary: string;
  detailed_analysis?: string;
}

interface HistoryDetail {
  id: number;
  session_id: string;
  file_name: string;
  overall_score: number;
  dimensions: {
    clarity: number;
    completeness: number;
    correctness: number;
    usability: number;
    documentation: number;
  };
  issues: Array<{
    severity: "error" | "warning" | "info";
    file: string;
    message: string;
  }>;
  suggestions: string[];
  summary: string;
  detailed_analysis?: string;
  created_at: string;
}

export interface AnalysisResponse {
  success: boolean;
  result?: SkillAnalysisResult;
  error?: string;
  sessionId?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

// Generate session ID on frontend
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SkillAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<HistoryDetail | null>(null);
  const [historyDetailedAnalysis, setHistoryDetailedAnalysis] = useState<string | null>(null);
  const [historyScore, setHistoryScore] = useState<number | undefined>(undefined);

  const {
    connectionStatus,
    streamingContent,
    currentStatus,
    currentStep,
    finalResult,
    error: wsError,
    isComplete,
    registerSession,
    reset: resetWS
  } = useWebSocket();

  // Handle WebSocket final result
  useEffect(() => {
    if (finalResult && isComplete) {
      setResult(finalResult as SkillAnalysisResult);
      setIsAnalyzing(false);
    }
  }, [finalResult, isComplete]);

  // Handle WebSocket error
  useEffect(() => {
    if (wsError && isAnalyzing) {
      setError(wsError);
      setIsAnalyzing(false);
    }
  }, [wsError, isAnalyzing]);

  const handleUpload = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    resetWS();

    // Generate session ID on frontend
    const sessionId = generateSessionId();
    setCurrentSessionId(sessionId);

    // Register session with WebSocket first
    registerSession(sessionId);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const data: AnalysisResponse = await response.json();

      if (!data.success && data.error) {
        setError(data.error);
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to server");
      setIsAnalyzing(false);
    }
  }, [registerSession, resetWS]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setCurrentSessionId(null);
    setHistoryDetail(null);
    setHistoryDetailedAnalysis(null);
    setHistoryScore(undefined);
    resetWS();
  }, [resetWS]);

  const handleSelectHistory = useCallback((detail: HistoryDetail) => {
    setHistoryDetail(detail);
    setHistoryDetailedAnalysis(detail.detailed_analysis || null);
    setHistoryScore(detail.overall_score);
    setResult({
      overall_score: detail.overall_score,
      dimensions: detail.dimensions,
      issues: detail.issues,
      suggestions: detail.suggestions,
      summary: detail.summary,
    });
    setShowHistory(false);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setShowHistory(false);
    setHistoryDetail(null);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-zinc-100">Skill Checker</h1>
                <p className="text-sm text-zinc-500">AI-powered quality analysis with streaming output</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {result && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Analyze Another
                </button>
              )}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  showHistory
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Dual Panel Layout */}
      <main className="flex-1 flex min-h-0">
        {/* Left Panel */}
        <div className="w-1/2 border-r border-zinc-800 p-6 overflow-y-auto">
          {showHistory ? (
            <HistoryPanel
              onSelectHistory={handleSelectHistory}
              onClose={handleCloseHistory}
            />
          ) : result ? (
            <AnalysisResult result={result} />
          ) : (
            <UploadZone onUpload={handleUpload} error={error} isAnalyzing={isAnalyzing} />
          )}
        </div>

        {/* Right Panel - Stream Output */}
        <div className="w-1/2 p-6 flex flex-col min-h-0">
          <h2 className="flex-shrink-0 text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Claude Output
          </h2>
          <div className="flex-1 min-h-0">
            <StreamOutput
              connectionStatus={connectionStatus}
              streamingContent={streamingContent}
              currentStatus={currentStatus}
              currentStep={currentStep}
              finalResult={finalResult}
              error={wsError}
              isComplete={isComplete}
              onReset={resetWS}
              historyContent={historyDetailedAnalysis}
              historyScore={historyScore}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800">
        <div className="max-w-full mx-auto px-6 py-4">
          <p className="text-center text-sm text-zinc-500">
            Powered by Claude AI
          </p>
        </div>
      </footer>
    </div>
  );
}
