import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import unzipper from 'unzipper';
import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';

const app = express();
const PORT = process.env.PORT || 8002;

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
}

interface AnalysisResponse {
  success: boolean;
  result?: SkillAnalysisResult;
  error?: string;
}

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

// Analyze skill with Claude Agent SDK
async function analyzeSkillWithClaude(filesContent: Record<string, string>): Promise<SkillAnalysisResult> {
  // Build the prompt with file contents
  const filesSection = Object.entries(filesContent)
    .map(([filename, content]) => `--- ${filename} ---\n${content}`)
    .join('\n\n');

  const prompt = `你是一个技能质量分析专家。请分析以下技能文件并提供全面的质量评估。

技能文件:
${filesSection}

请从以下维度分析这个技能，并给出0-100的评分:

1. **清晰度** - 技能描述和目的的清晰程度和可理解性如何？
2. **完整性** - 技能是否具备所有必要的组件（触发器、指令、示例）？
3. **正确性** - 是否存在逻辑错误或不一致之处？
4. **易用性** - 用户使用这个技能的难易程度如何？
5. **文档质量** - 注释、示例和解释的质量如何？

请严格按照以下JSON格式返回结果:
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
        {"severity": "error|warning|info", "file": "<文件名>", "message": "<问题描述>"},
        ...
    ],
    "suggestions": [
        "<改进建议1>",
        "<改进建议2>",
        ...
    ],
    "summary": "<2-3句话总结技能质量>"
}

请提供详细但简洁的分析，重点关注可操作的反馈。只返回JSON，不要额外的文字。`;

  // Configure Claude Agent SDK options
  // Use globally installed claude CLI or the one from SDK package
  const claudeCliPath = process.env.CLAUDE_CLI_PATH || '/opt/homebrew/bin/claude';

  const options = {
    model: process.env.ANTHROPIC_MODEL || 'glm-5',
    maxTurns: 1,
    pathToClaudeCodeExecutable: claudeCliPath,
    env: {
      CLAUDECODE: '', // Bypass nested session check
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
    },
  };

  // Collect response text from the async iterator
  let responseText = '';

  try {
    for await (const message of query({ prompt, options })) {
      if (message.type === 'assistant') {
        // SDKAssistantMessage has a 'message' property containing APIAssistantMessage
        const assistantMessage = message.message;
        if (assistantMessage && assistantMessage.content) {
          for (const block of assistantMessage.content) {
            if (block.type === 'text') {
              responseText += (block as any).text;
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

  if (!responseText) {
    throw new Error('No response received from Claude Agent SDK');
  }

  // Parse JSON response
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = responseText.trim();
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  }

  const resultData = JSON.parse(jsonStr);
  return resultData as SkillAnalysisResult;
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
        error: 'No skill files found in upload. Expected .md, .yaml, .yml, .json, or .txt files.'
      } as AnalysisResponse);
    }

    // Analyze with Claude Agent SDK
    const result = await analyzeSkillWithClaude(filesContent);

    return res.json({
      success: true,
      result
    } as AnalysisResponse);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Claude Code not found') || errorMessage.includes('CLINotFoundError')) {
      return res.json({
        success: false,
        error: 'Claude Code CLI not found. Please install it: npm install -g @anthropic-ai/claude-agent-sdk'
      } as AnalysisResponse);
    }

    return res.json({
      success: false,
      error: `Analysis failed: ${errorMessage}`
    } as AnalysisResponse);
  } finally {
    // Cleanup
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Skill Checker Backend running on http://localhost:${PORT}`);
});
