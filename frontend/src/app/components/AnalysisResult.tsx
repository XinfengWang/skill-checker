"use client";

import { SkillAnalysisResult } from "../page";

interface AnalysisResultProps {
  result: SkillAnalysisResult;
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-zinc-800"
          />
          <circle
            cx="48"
            cy="48"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-zinc-100">{score}</span>
        </div>
      </div>
      <span className="text-sm text-zinc-400 mt-2">{label}</span>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function getScoreGradient(score: number): string {
  if (score >= 80) return "from-emerald-500 to-emerald-600";
  if (score >= 60) return "from-amber-500 to-amber-600";
  return "from-red-500 to-red-600";
}

function SeverityIcon({ severity }: { severity: "error" | "warning" | "info" }) {
  const colors = {
    error: "text-red-400 bg-red-500/10",
    warning: "text-amber-400 bg-amber-500/10",
    info: "text-blue-400 bg-blue-500/10",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[severity]}`}>
      {severity}
    </span>
  );
}

export function AnalysisResult({ result }: AnalysisResultProps) {
  const gradientClass = getScoreGradient(result.overall_score);

  return (
    <div className="space-y-8">
      {/* Header with Overall Score */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Analysis Complete</h2>
        <p className="text-zinc-500 mt-1">{result.summary}</p>
      </div>

      {/* Overall Score Card */}
      <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradientClass} bg-opacity-10 border border-white/10`}>
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-white/20"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 - (result.overall_score / 100) * 2 * Math.PI * 48}
                strokeLinecap="round"
                className="text-white"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{result.overall_score.toFixed(0)}</span>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Overall Score</h3>
            <p className="text-white/70 text-sm mt-1">
              {result.overall_score >= 80
                ? "Excellent quality skill"
                : result.overall_score >= 60
                ? "Good skill with room for improvement"
                : "Needs significant improvements"}
            </p>
          </div>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="grid grid-cols-5 gap-4">
        <ScoreRing score={result.dimensions.clarity} label="Clarity" color={getScoreColor(result.dimensions.clarity)} />
        <ScoreRing score={result.dimensions.completeness} label="Completeness" color={getScoreColor(result.dimensions.completeness)} />
        <ScoreRing score={result.dimensions.correctness} label="Correctness" color={getScoreColor(result.dimensions.correctness)} />
        <ScoreRing score={result.dimensions.usability} label="Usability" color={getScoreColor(result.dimensions.usability)} />
        <ScoreRing score={result.dimensions.documentation} label="Documentation" color={getScoreColor(result.dimensions.documentation)} />
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-100">
              Issues ({result.issues.length})
            </h3>
          </div>
          <div className="divide-y divide-zinc-800">
            {result.issues.map((issue, i) => (
              <div key={i} className="px-6 py-4 flex items-start gap-4">
                <SeverityIcon severity={issue.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">{issue.message}</p>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">{issue.file}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-100">
              Suggestions
            </h3>
          </div>
          <div className="px-6 py-4">
            <ul className="space-y-3">
              {result.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-sm text-zinc-300">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
