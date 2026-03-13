import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import unzipper from 'unzipper';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  saveAnalysis,
  getHistoryList,
  getHistoryById,
  deleteHistory,
  closeDatabase,
  AnalysisHistoryRecord
} from './database';

const app = express();
const PORT = process.env.PORT || 8002;

// Create HTTP server and attach WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({
  origin: ['http://localhost:3002', 'http://127.0.0.1:3002'],
  credentials: true
}));
app.use(express.json());

// Multer configuration for file uploads
const upload = multer({ dest: os.tmpdir() });

// Types
interface SkillAnalysisResult {
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
}

interface AnalysisResponse {
  success: boolean;
  result?: SkillAnalysisResult;
  error?: string;
  sessionId?: string;
}

// History API response types
interface HistoryListResponse {
  success: boolean;
  data?: {
    data: any[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

interface HistoryDetailResponse {
  success: boolean;
  data?: AnalysisHistoryRecord;
  error?: string;
}

// WebSocket message types
interface WSMessage {
  type: 'status' | 'text' | 'result' | 'error' | 'complete' | 'step';
  payload: any;
  timestamp: number;
}

// Active WebSocket connections by session ID
const sessions = new Map<string, WebSocket>();

// Generate unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Send WebSocket message
function sendWSMessage(ws: WebSocket, type: WSMessage['type'], payload: any) {
  if (ws.readyState === WebSocket.OPEN) {
    const message: WSMessage = {
      type,
      payload,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(message));
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'register' && message.sessionId) {
        sessions.set(message.sessionId, ws);
        console.log(`Session registered: ${message.sessionId}`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    // Remove session from map
    sessions.forEach((value, key) => {
      if (value === ws) {
        sessions.delete(key);
      }
    });
    console.log('WebSocket client disconnected');
  });
});

// Helper function to get skill files content
async function getSkillFilesContent(skillDir: string): Promise<Record<string, string>> {
  const filesContent: Record<string, string> = {};
  const skillPatterns = ['.md', '.yaml', '.yml', '.json', '.txt'];

  async function scanDirectory(dir: string, basePath: string = ''): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, relativePath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (skillPatterns.includes(ext)) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            filesContent[relativePath] = content;
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }
      }
    }
  }

  await scanDirectory(skillDir);
  return filesContent;
}

// Stream callback type
type StreamCallback = (type: 'status' | 'text' | 'step', payload: any) => void;

// Claude SDK options builder
function getClaudeOptions() {
  const claudeCliPath = process.env.CLAUDE_CLI_PATH || '/opt/homebrew/bin/claude';
  return {
    model: process.env.ANTHROPIC_MODEL || 'glm-5',
    maxTurns: 1,
    pathToClaudeCodeExecutable: claudeCliPath,
    env: {
      CLAUDECODE: '', // Bypass nested session check
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
    },
  };
}

// Helper to call Claude and stream response
async function callClaudeWithStreaming(
  prompt: string,
  onStream?: StreamCallback,
  stepInfo?: { step: string; message: string }
): Promise<string> {
  const options = getClaudeOptions();

  // Send step status
  if (onStream && stepInfo) {
    onStream('step', stepInfo);
    onStream('status', stepInfo);
  }

  let responseText = '';
  let lastSentLength = 0;

  try {
    for await (const message of query({ prompt, options })) {
      if (message.type === 'assistant') {
        const assistantMessage = message.message;
        if (assistantMessage && assistantMessage.content) {
          for (const block of assistantMessage.content) {
            if (block.type === 'text') {
              const newText = (block as any).text;
              responseText += newText;

              // Stream incremental text
              if (onStream && responseText.length > lastSentLength) {
                onStream('text', {
                  content: newText,
                  accumulated: responseText
                });
                lastSentLength = responseText.length;
              }
            }
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype !== 'success') {
          const errorMsg = (message as any).result || (message as any).errors?.join(', ');
          throw new Error(`Claude Agent SDK error: ${errorMsg}`);
        }
      }
    }
  } catch (error) {
    throw error;
  }

  return responseText;
}

// Step 1: Detailed Analysis
async function performDetailedAnalysis(
  filesContent: Record<string, string>,
  onStream?: StreamCallback
): Promise<string> {
  const filesSection = Object.entries(filesContent)
    .map(([filename, content]) => `--- ${filename} ---\n${content}`)
    .join('\n\n');

  const prompt = `你是一个技能质量分析专家。请对以下技能文件进行详细的分析。

技能文件:
${filesSection}

请从以下5个维度进行深入分析：

## 1. 清晰度 (Clarity)
- 技能描述和目的是否清晰明确？
- 用户能否快速理解这个技能的作用？
- 指令和参数说明是否清楚？

## 2. 完整性 (Completeness)
- 技能是否具备所有必要的组件？
- 是否包含触发器、指令、示例等关键元素？
- 是否有遗漏的重要配置？

## 3. 正确性 (Correctness)
- 是否存在逻辑错误或不一致之处？
- 配置语法是否正确？
- 各组件之间的关联是否合理？

## 4. 易用性 (Usability)
- 用户使用这个技能的难易程度如何？
- 是否需要过多的前置知识？
- 错误处理和边界情况是否考虑周全？

## 5. 文档质量 (Documentation)
- 注释是否充分？
- 示例是否清晰有效？
- 是否有完整的说明文档？

请提供详细的分析报告，指出优点和问题，并给出具体的改进建议。用中文回答，格式清晰。`;

  return await callClaudeWithStreaming(prompt, onStream, {
    step: 'analysis',
    message: '正在进行详细分析...'
  });
}

// Step 2: Structured Scoring
async function performStructuredScoring(
  filesContent: Record<string, string>,
  detailedAnalysis: string,
  onStream?: StreamCallback
): Promise<SkillAnalysisResult> {
  const filesSection = Object.entries(filesContent)
    .map(([filename, content]) => `--- ${filename} ---\n${content}`)
    .join('\n\n');

  const prompt = `基于以下技能文件和详细分析报告，请给出结构化的评分结果。

## 技能文件:
${filesSection}

## 详细分析报告:
${detailedAnalysis}

请根据分析报告，给出0-100的评分，并严格按照以下JSON格式返回结果:
{
    "overall_score": <总分 0-100>,
    "dimensions": {
        "clarity": <清晰度 0-100>,
        "completeness": <完整性 0-100>,
        "correctness": <正确性 0-100>,
        "usability": <易用性 0-100>,
        "documentation": <文档质量 0-100>
    },
    "issues": [
        {"severity": "error|warning|info", "file": "<文件名>", "message": "<问题描述>"}
    ],
    "suggestions": [
        "<改进建议>"
    ],
    "summary": "<2-3句话总结技能质量>"
}

只返回JSON，不要额外的文字。`;

  const responseText = await callClaudeWithStreaming(prompt, onStream, {
    step: 'scoring',
    message: '正在进行结构化评分...'
  });

  if (!responseText) {
    throw new Error('No response received from Claude for scoring');
  }

  // Parse JSON response
  let jsonStr = responseText.trim();
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  }

  const resultData = JSON.parse(jsonStr);
  // Attach detailed analysis to result
  resultData.detailed_analysis = detailedAnalysis;
  return resultData as SkillAnalysisResult;
}

// Main workflow: Two-step analysis
async function analyzeSkillWithClaude(
  filesContent: Record<string, string>,
  onStream?: StreamCallback
): Promise<SkillAnalysisResult> {
  // Send workflow start status
  if (onStream) {
    onStream('status', {
      step: 'start',
      message: '开始工作流：详细分析 -> 结构化评分'
    });
  }

  // Step 1: Perform detailed analysis
  const detailedAnalysis = await performDetailedAnalysis(filesContent, onStream);

  // Add separator between steps
  if (onStream) {
    onStream('text', {
      content: '\n\n---\n\n## 开始结构化评分...\n\n',
      accumulated: ''
    });
  }

  // Step 2: Perform structured scoring based on analysis
  const result = await performStructuredScoring(filesContent, detailedAnalysis, onStream);

  return result;
}

// API Routes
app.post('/api/analyze', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'No file provided'
    } as AnalysisResponse);
  }

  // Get sessionId from request body or header (frontend generates it)
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] as string || generateSessionId();
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'skill-check-'));

  try {
    const originalName = file.originalname || 'uploaded_file';
    const tempFile = path.join(tempDir, originalName);

    // Move uploaded file
    await fs.promises.rename(file.path, tempFile);

    let skillDir = tempDir;

    // Extract if zip
    if (originalName.endsWith('.zip')) {
      const extractDir = path.join(tempDir, 'extracted');
      await fs.promises.mkdir(extractDir);

      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(tempFile)
          .pipe(unzipper.Extract({ path: extractDir }))
          .on('close', () => resolve())
          .on('error', reject);
      });

      skillDir = extractDir;
    }

    // Get skill files content
    const filesContent = await getSkillFilesContent(skillDir);

    if (Object.keys(filesContent).length === 0) {
      return res.json({
        success: false,
        error: 'No skill files found in upload. Expected .md, .yaml, .yml, .json, or .txt files.',
        sessionId
      } as AnalysisResponse);
    }

    // Return session ID immediately
    res.json({
      success: true,
      sessionId
    } as AnalysisResponse);

    // Small delay to ensure WebSocket registration completes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get WebSocket connection for this session
    let ws = sessions.get(sessionId);

    // Retry getting WebSocket connection a few times
    for (let i = 0; i < 5 && !ws; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      ws = sessions.get(sessionId);
    }

    // Analyze with Claude Agent SDK with streaming
    const streamCallback: StreamCallback = (type, payload) => {
      const currentWs = sessions.get(sessionId);
      if (currentWs) {
        sendWSMessage(currentWs, type, payload);
      }
    };

    const result = await analyzeSkillWithClaude(filesContent, streamCallback);

    // Save result to database
    try {
      saveAnalysis({
        sessionId,
        fileName: originalName,
        overallScore: result.overall_score,
        dimensions: result.dimensions,
        issues: result.issues,
        suggestions: result.suggestions,
        summary: result.summary,
        detailedAnalysis: result.detailed_analysis
      });
      console.log(`Analysis saved to database: session=${sessionId}`);
    } catch (dbError) {
      console.error('Failed to save analysis to database:', dbError);
      // Don't fail the request if database save fails
    }

    // Send final result
    const finalWs = sessions.get(sessionId);
    if (finalWs) {
      sendWSMessage(finalWs, 'result', { success: true, result });
      sendWSMessage(finalWs, 'complete', {});
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Send error via WebSocket if connected
    const ws = sessions.get(sessionId);
    if (ws) {
      let errorMsg = `Analysis failed: ${errorMessage}`;
      if (errorMessage.includes('Claude Code not found') || errorMessage.includes('CLINotFoundError')) {
        errorMsg = 'Claude Code CLI not found. Please install it: npm install -g @anthropic-ai/claude-agent-sdk';
      }
      sendWSMessage(ws, 'error', { message: errorMsg });
      sendWSMessage(ws, 'complete', {});
    }

  } finally {
    // Cleanup
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    // Remove session
    sessions.delete(sessionId);
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy' });
});

// History API Routes

// Get history list with pagination
app.get('/api/history', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = getHistoryList(page, limit);

    res.json({
      success: true,
      data: result
    } as HistoryListResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history'
    } as HistoryListResponse);
  }
});

// Get single history record by ID
app.get('/api/history/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid history ID'
      } as HistoryDetailResponse);
    }

    const record = getHistoryById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'History record not found'
      } as HistoryDetailResponse);
    }

    res.json({
      success: true,
      data: record
    } as HistoryDetailResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history'
    } as HistoryDetailResponse);
  }
});

// Delete history record
app.delete('/api/history/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid history ID'
      });
    }

    const deleted = deleteHistory(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'History record not found'
      });
    }

    res.json({
      success: true,
      message: 'History deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete history'
    });
  }
});

// Start server with WebSocket support
server.listen(PORT, () => {
  console.log(`Skill Checker Backend running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
