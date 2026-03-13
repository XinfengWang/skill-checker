import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file path
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'history.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db: Database.Database = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    dimensions TEXT NOT NULL,
    issues TEXT NOT NULL,
    suggestions TEXT NOT NULL,
    summary TEXT NOT NULL,
    detailed_analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create index for faster queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_created_at ON analysis_history(created_at DESC)
`);

// Types
export interface AnalysisHistoryRecord {
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
    severity: 'error' | 'warning' | 'info';
    file: string;
    message: string;
  }>;
  suggestions: string[];
  summary: string;
  detailed_analysis?: string;
  created_at: string;
}

export interface AnalysisHistoryListItem {
  id: number;
  session_id: string;
  file_name: string;
  overall_score: number;
  summary: string;
  created_at: string;
}

export interface SaveAnalysisParams {
  sessionId: string;
  fileName: string;
  overallScore: number;
  dimensions: AnalysisHistoryRecord['dimensions'];
  issues: AnalysisHistoryRecord['issues'];
  suggestions: string[];
  summary: string;
  detailedAnalysis?: string;
}

// Save analysis result
export function saveAnalysis(params: SaveAnalysisParams): number {
  const stmt = db.prepare(`
    INSERT INTO analysis_history (
      session_id, file_name, overall_score, dimensions, issues, suggestions, summary, detailed_analysis
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    params.sessionId,
    params.fileName,
    params.overallScore,
    JSON.stringify(params.dimensions),
    JSON.stringify(params.issues),
    JSON.stringify(params.suggestions),
    params.summary,
    params.detailedAnalysis || null
  );

  return result.lastInsertRowid as number;
}

// Get history list with pagination
export function getHistoryList(page: number = 1, limit: number = 20): {
  data: AnalysisHistoryListItem[];
  total: number;
  page: number;
  limit: number;
} {
  const offset = (page - 1) * limit;

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM analysis_history');
  const { count } = countStmt.get() as { count: number };

  const stmt = db.prepare(`
    SELECT id, session_id, file_name, overall_score, summary, created_at
    FROM analysis_history
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as AnalysisHistoryListItem[];

  return {
    data: rows,
    total: count,
    page,
    limit
  };
}

// Get single history record by ID
export function getHistoryById(id: number): AnalysisHistoryRecord | null {
  const stmt = db.prepare('SELECT * FROM analysis_history WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) {
    return null;
  }

  return {
    ...row,
    dimensions: JSON.parse(row.dimensions),
    issues: JSON.parse(row.issues),
    suggestions: JSON.parse(row.suggestions)
  };
}

// Get history by session ID
export function getHistoryBySessionId(sessionId: string): AnalysisHistoryRecord | null {
  const stmt = db.prepare('SELECT * FROM analysis_history WHERE session_id = ?');
  const row = stmt.get(sessionId) as any;

  if (!row) {
    return null;
  }

  return {
    ...row,
    dimensions: JSON.parse(row.dimensions),
    issues: JSON.parse(row.issues),
    suggestions: JSON.parse(row.suggestions)
  };
}

// Delete history record
export function deleteHistory(id: number): boolean {
  const stmt = db.prepare('DELETE FROM analysis_history WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Close database connection (for graceful shutdown)
export function closeDatabase(): void {
  db.close();
}

export default db;
