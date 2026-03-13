# Skill Checker

AI-powered skill quality analysis tool using Claude.

## Features

- Upload skill files (.md, .yaml, .yml, .json, .txt) or zip folders
- AI-powered quality analysis across 5 dimensions:
  - **Clarity** - How clear and understandable is the skill
  - **Completeness** - Whether all necessary components are present
  - **Correctness** - Logical errors or inconsistencies
  - **Usability** - Ease of use for users
  - **Documentation** - Quality of comments and examples
- Detailed issues and suggestions
- Modern dark-themed UI

## Prerequisites

- Node.js 18+
- Python 3.10+
- Anthropic API key

## Setup

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the backend directory:

```bash
cd backend
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Or run both with:
```bash
npm run dev
```

### 4. Access the Application

Open http://localhost:3002 in your browser.

## Usage

1. Upload a skill file or zip folder containing skill files
2. Wait for Claude to analyze the skill
3. Review the overall score and dimension breakdown
4. Check identified issues and improvement suggestions

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python
- **AI**: Claude API (claude-sonnet-4-20250514)
