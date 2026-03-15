# 🤖 Scrum Master Agent

An AI-powered Scrum Master dashboard that connects to JIRA and provides intelligent sprint analysis.

## Features

- 📊 **Real-time JIRA Integration** - Fetches live sprint data
- 🧠 **AI Analysis** - Claude-powered insights and recommendations
- 📈 **Visual Dashboard** - Burndown charts, health scores, team workload
- 👥 **Individual Standups** - Per-member standup summaries
- 🎯 **Customizable Prompts** - Change agent personality via prompts
- 🚀 **Auto-Deploy** - Push to GitHub, auto-deploys to hosting

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/scrum-master-agent.git
cd scrum-master-agent
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
JIRA_HOST=https://jawedislam85.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=SAT
CLAUDE_API_KEY=your-claude-api-key
```

### 3. Run Locally
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Deploy to Production
Push to `main` branch and GitHub Actions will auto-deploy to your hosting.

## Project Structure

```
/scrum-master-agent
├── /public
│   └── index.html          # Main dashboard (works standalone)
├── /src
│   ├── jira-connector.js   # JIRA API integration
│   ├── agent.js            # Claude AI analysis
│   └── prompts.js          # Customizable agent prompts
├── /config
│   └── settings.json       # Agent configuration
├── /.github
│   └── /workflows
│       └── deploy.yml      # Auto-deploy workflow
├── server.js               # Node.js server (if supported)
├── api.php                 # PHP API fallback
├── .env.example            # Environment template
└── package.json
```

## Customizing the Agent

### Change Agent Personality
Edit `src/prompts.js` to modify how the agent analyzes and reports:

```javascript
export const PROMPTS = {
  strict: "You are a strict scrum master...",
  coach: "You are a supportive agile coach...",
  executive: "You are reporting to executives...",
};
```

### Add New Data Sources
Edit `src/jira-connector.js` to add more JIRA fields or connect additional services.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JIRA_HOST` | Your Atlassian URL |
| `JIRA_EMAIL` | Your Atlassian login email |
| `JIRA_API_TOKEN` | API token from Atlassian |
| `JIRA_PROJECT_KEY` | Project key (e.g., SAT) |
| `CLAUDE_API_KEY` | Anthropic API key |

## License

MIT
