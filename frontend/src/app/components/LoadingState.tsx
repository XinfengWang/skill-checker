export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800"></div>
        <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"></div>
      </div>

      <h3 className="text-xl font-semibold text-zinc-100 mb-2">
        Analyzing Skill
      </h3>
      <p className="text-zinc-500">
        Claude is reviewing your skill files...
      </p>

      <div className="flex items-center gap-2 mt-6">
        {["Reading files", "Analyzing structure", "Evaluating quality", "Generating report"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-700">→</span>}
            <span
              className="text-sm text-zinc-600 animate-pulse"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
