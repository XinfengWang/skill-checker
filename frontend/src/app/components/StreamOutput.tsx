'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConnectionStatus, StatusPayload, StepPayload, SkillAnalysisResult } from './useWebSocket';

interface StreamOutputProps {
  connectionStatus: ConnectionStatus;
  streamingContent: string;
  currentStatus: StatusPayload | null;
  currentStep: StepPayload | null;
  finalResult: SkillAnalysisResult | null;
  error: string | null;
  isComplete: boolean;
  onReset?: () => void;
  historyContent?: string; // 历史记录的详细分析内容
  historyScore?: number; // 历史记录的分数
}

// Step display configuration
const stepConfig: Record<string, { label: string; icon: string }> = {
  'start': { label: '工作流开始', icon: '🚀' },
  'analysis': { label: '详细分析', icon: '🔍' },
  'scoring': { label: '结构化评分', icon: '📊' },
};

export function StreamOutput({
  connectionStatus,
  streamingContent,
  currentStatus,
  currentStep,
  finalResult,
  error,
  isComplete,
  onReset,
  historyContent,
  historyScore
}: StreamOutputProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamingContent]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-zinc-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const getStepDisplay = () => {
    if (!currentStep) return null;
    const config = stepConfig[currentStep.step] || { label: currentStep.step, icon: '⚙️' };
    return config;
  };

  const stepDisplay = getStepDisplay();

  return (
    <div className="h-full flex flex-col bg-zinc-900 rounded-xl border border-zinc-800">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {historyContent ? (
            <>
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-sm text-zinc-400">History Record</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
              <span className="text-sm text-zinc-400">{getStatusText()}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {historyContent && (
            <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 rounded-full">
              <span>📋</span>
              <span className="text-sm text-violet-400">Detailed Analysis</span>
            </div>
          )}
          {currentStep && stepDisplay && !historyContent && (
            <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 rounded-full">
              <span>{stepDisplay.icon}</span>
              <span className="text-sm text-violet-400">{stepDisplay.label}</span>
            </div>
          )}
          {onReset && (streamingContent || finalResult || error || historyContent) && (
            <button
              onClick={onReset}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Clear output"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content area - Fixed height with scroll */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 prose prose-invert prose-sm max-w-none
          prose-headings:text-zinc-100 prose-headings:font-semibold
          prose-h1:text-xl prose-h1:border-b prose-h1:border-zinc-700 prose-h1:pb-2
          prose-h2:text-lg prose-h2:text-violet-300
          prose-h3:text-base prose-h3:text-zinc-200
          prose-p:text-zinc-300 prose-p:leading-relaxed
          prose-li:text-zinc-300
          prose-code:text-violet-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700
          prose-strong:text-zinc-100
          prose-em:text-zinc-300
          prose-blockquote:border-l-violet-500 prose-blockquote:bg-zinc-800/50 prose-blockquote:py-1
          prose-ul:text-zinc-300 prose-ol:text-zinc-300
          prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline"
      >
        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg not-prose">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* History content */}
        {historyContent && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {historyContent}
          </ReactMarkdown>
        )}

        {/* Streaming content with Markdown rendering */}
        {streamingContent && !historyContent && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {streamingContent}
          </ReactMarkdown>
        )}

        {/* Waiting state */}
        {!streamingContent && !finalResult && !error && !historyContent && (
          <div className="flex items-center justify-center h-full text-zinc-500 not-prose">
            <p>Waiting for analysis to start...</p>
          </div>
        )}

        {/* Complete indicator */}
        {isComplete && !error && !historyContent && (
          <div className="mt-4 pt-4 border-t border-zinc-800 not-prose">
            <div className="flex items-center gap-2 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Analysis complete</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {(streamingContent || finalResult || historyContent) && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center justify-between">
            <span>
              {historyContent
                ? `${historyContent.length} characters`
                : `${streamingContent.length} characters received`}
            </span>
            {(finalResult || historyScore !== undefined) && (
              <span className="text-violet-400">
                Score: {historyScore !== undefined ? historyScore : finalResult?.overall_score}/100
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
