"use client";

import { useState, useEffect, useCallback } from "react";

interface HistoryItem {
  id: number;
  session_id: string;
  file_name: string;
  overall_score: number;
  summary: string;
  created_at: string;
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

interface HistoryPanelProps {
  onSelectHistory: (detail: HistoryDetail) => void;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

export function HistoryPanel({ onSelectHistory, onClose }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/history?page=${page}&limit=20`);
      const data = await response.json();
      if (data.success) {
        setHistory(data.data.data);
        setTotal(data.data.total);
      } else {
        setError(data.error || "Failed to fetch history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    try {
      const response = await fetch(`${API_URL}/api/history/${id}`);
      const data = await response.json();
      if (data.success) {
        onSelectHistory(data.data);
      } else {
        setError(data.error || "Failed to fetch history detail");
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history detail");
      setSelectedId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this record?")) {
      return;
    }
    setDeleting(id);
    try {
      const response = await fetch(`${API_URL}/api/history/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setHistory(history.filter((item) => item.id !== id));
        setTotal(total - 1);
      } else {
        setError(data.error || "Failed to delete history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete history");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Analysis History
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
        </div>
      )}

      {/* History List */}
      {!loading && history.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">No history records found</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <>
          <div className="flex-1 overflow-y-auto space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedId === item.id
                    ? "bg-violet-900/30 border-violet-700"
                    : "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-100 truncate">
                        {item.file_name}
                      </span>
                      <span className={`text-sm font-bold ${getScoreColor(item.overall_score)}`}>
                        {item.overall_score}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2">{item.summary}</p>
                    <p className="text-xs text-zinc-600 mt-1">{formatDate(item.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deleting === item.id}
                    className="ml-2 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === item.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
