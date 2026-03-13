"use client";

import { useCallback, useState } from "react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  error: string | null;
}

export function UploadZone({ onUpload, error }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      onUpload(file);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  }, [onUpload]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-zinc-100 mb-3">
          Analyze Your Skill
        </h2>
        <p className="text-zinc-400 max-w-md">
          Upload a skill file or folder to get AI-powered quality analysis with detailed scoring and suggestions.
        </p>
      </div>

      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative w-full max-w-xl aspect-[2/1] rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-300 ease-out
          ${isDragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-zinc-700 hover:border-zinc-600 bg-zinc-900/50"
          }
        `}
      >
        <input
          type="file"
          className="hidden"
          accept=".md,.yaml,.yml,.json,.txt,.zip"
          onChange={handleFileSelect}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
          <div className={`
            w-16 h-16 rounded-2xl mb-4 flex items-center justify-center
            transition-colors duration-300
            ${isDragging ? "bg-violet-500/20" : "bg-zinc-800"}
          `}>
            <svg
              className={`w-8 h-8 ${isDragging ? "text-violet-400" : "text-zinc-500"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-lg font-medium text-zinc-300 mb-2">
            {isDragging ? "Drop your file here" : "Drag & drop your skill file"}
          </p>
          <p className="text-sm text-zinc-500">
            or click to browse
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {[".md", ".yaml", ".yml", ".json", ".zip"].map((ext) => (
              <span
                key={ext}
                className="px-2 py-1 text-xs rounded-md bg-zinc-800 text-zinc-400"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>
      </label>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 max-w-xl w-full">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
