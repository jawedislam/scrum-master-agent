/**
 * Scrum Master Agent - Node.js Server
 * 
 * This server provides:
 * 1. Static file serving for the dashboard
 * 2. API proxy for JIRA (to hide credentials)
 * 3. Claude API proxy for AI analysis
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// JIRA Configuration
const JIRA_CONFIG = {
  host: process.env.JIRA_HOST || 'https://jawedislam85.atlassian.net',
  email: process.env.JIRA_EMAIL,
  apiToken: process.env.JIRA_API_TOKEN,
  projectKey: process.env.JIRA_PROJECT_KEY || 'SAT'
};

// Claude Configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    jiraConfigured: !!(JIRA_CONFIG.email && JIRA_CONFIG.apiToken),
    claudeConfigured: !!CLAUDE_API_KEY
  });
});

/**
 * Get configuration (without secrets)
 */
app.get('/api/config', (req, res) => {
  res.json({
    jiraHost: JIRA_CONFIG.host,
    projectKey: JIRA_CONFIG.projectKey,
    aiEnabled: !!CLAUDE_API_KEY
  });
});

/**
 * Proxy JIRA API requests
 */
app.get('/api/jira/*', async (req, res) => {
  try {
    const endpoint = req.path.replace('/api/jira', '');
    const jiraUrl = `${JIRA_CONFIG.host}/rest/api/3${endpoint}`;
    
    const authHeader = 'Basic ' + Buffer.from(`${JIRA_CONFIG.email}:${JIRA_CONFIG.apiToken}`).toString('base64');
    
    const response = await fetch(jiraUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`JIRA API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('JIRA API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Proxy JIRA Agile API requests
 */
app.get('/api/jira-agile/*', async (req, res) => {
  try {
    const endpoint = req.path.replace('/api/jira-agile', '');
    const jiraUrl = `${JIRA_CONFIG.host}/rest/agile/1.0${endpoint}`;
    
    const authHeader = 'Basic ' + Buffer.from(`${JIRA_CONFIG.email}:${JIRA_CONFIG.apiToken}`).toString('base64');
    
    const response = await fetch(jiraUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`JIRA Agile API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('JIRA Agile API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get sprint data (combined endpoint)
 */
app.get('/api/sprint-data', async (req, res) => {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${JIRA_CONFIG.email}:${JIRA_CONFIG.apiToken}`).toString('base64');
    const headers = {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Fetch issues
    const jql = `project = ${JIRA_CONFIG.projectKey} ORDER BY created DESC`;
    const issuesResponse = await fetch(
      `${JIRA_CONFIG.host}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,status,priority,assignee,customfield_10016,description,labels,issuetype,created,updated`,
      { headers }
    );
    
    if (!issuesResponse.ok) {
      throw new Error(`Failed to fetch issues: ${issuesResponse.status}`);
    }
    
    const issuesData = await issuesResponse.json();
    
    // Transform issues
    const issues = issuesData.issues.map(issue => ({
      id: issue.key,
      title: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      priority: issue.fields.priority?.name || 'Medium',
      assignee: issue.fields.assignee ? {
        id: issue.fields.assignee.accountId,
        name: issue.fields.assignee.displayName,
        email: issue.fields.assignee.emailAddress,
        avatar: issue.fields.assignee.avatarUrls?.['48x48']
      } : null,
      points: issue.fields.customfield_10016 || 0,
      description: issue.fields.description,
      labels: issue.fields.labels || [],
      type: issue.fields.issuetype?.name || 'Task',
      created: issue.fields.created,
      updated: issue.fields.updated
    }));

    // Try to fetch sprint info
    let sprint = null;
    try {
      const boardsResponse = await fetch(
        `${JIRA_CONFIG.host}/rest/agile/1.0/board?projectKeyOrId=${JIRA_CONFIG.projectKey}`,
        { headers }
      );
      
      if (boardsResponse.ok) {
        const boardsData = await boardsResponse.json();
        if (boardsData.values && boardsData.values.length > 0) {
          const boardId = boardsData.values[0].id;
          
          const sprintsResponse = await fetch(
            `${JIRA_CONFIG.host}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
            { headers }
          );
          
          if (sprintsResponse.ok) {
            const sprintsData = await sprintsResponse.json();
            if (sprintsData.values && sprintsData.values.length > 0) {
              const s = sprintsData.values[0];
              const startDate = s.startDate ? new Date(s.startDate) : new Date();
              const endDate = s.endDate ? new Date(s.endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              const today = new Date();
              
              sprint = {
                id: s.id,
                name: s.name,
                goal: s.goal || '',
                state: s.state,
                startDate: s.startDate,
                endDate: s.endDate,
                totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
                daysRemaining: Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)))
              };
            }
          }
        }
      }
    } catch (sprintError) {
      console.log('Sprint fetch failed, using defaults:', sprintError.message);
    }

    // Default sprint if none found
    if (!sprint) {
      sprint = {
        id: 'default',
        name: 'Current Sprint',
        totalDays: 14,
        daysRemaining: 7
      };
    }

    // Calculate metrics
    const byStatus = {
      done: issues.filter(i => i.status.toLowerCase().includes('done')),
      inProgress: issues.filter(i => i.status.toLowerCase().includes('progress')),
      blocked: issues.filter(i => i.status.toLowerCase().includes('block')),
      todo: issues.filter(i => i.status.toLowerCase().includes('to do') || i.status.toLowerCase() === 'open')
    };

    const pointsByStatus = {
      done: byStatus.done.reduce((sum, i) => sum + (i.points || 0), 0),
      inProgress: byStatus.inProgress.reduce((sum, i) => sum + (i.points || 0), 0),
      blocked: byStatus.blocked.reduce((sum, i) => sum + (i.points || 0), 0),
      todo: byStatus.todo.reduce((sum, i) => sum + (i.points || 0), 0)
    };

    const totalPoints = Object.values(pointsByStatus).reduce((a, b) => a + b, 0);
    const completionRate = totalPoints > 0 ? (pointsByStatus.done / totalPoints) * 100 : 0;

    // Get unique team members
    const team = [];
    const seenIds = new Set();
    issues.forEach(issue => {
      if (issue.assignee && !seenIds.has(issue.assignee.id)) {
        seenIds.add(issue.assignee.id);
        team.push(issue.assignee);
      }
    });

    res.json({
      sprint,
      issues,
      team,
      metrics: {
        byStatus: {
          done: byStatus.done.length,
          inProgress: byStatus.inProgress.length,
          blocked: byStatus.blocked.length,
          todo: byStatus.todo.length
        },
        pointsByStatus,
        totalPoints,
        completionRate,
        issueCount: issues.length
      }
    });
  } catch (error) {
    console.error('Sprint data error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Claude AI analysis endpoint
 */
app.post('/api/analyze', async (req, res) => {
  try {
    if (!CLAUDE_API_KEY) {
      return res.status(400).json({ error: 'Claude API key not configured' });
    }

    const { sprintData, prompt } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `${prompt}

Here is the sprint data to analyze:
${JSON.stringify(sprintData, null, 2)}

Analyze this data and respond with JSON only, no markdown formatting.`
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Parse JSON response
    const cleaned = text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);
    
    res.json({ ...analysis, isAI: true });
  } catch (error) {
    console.error('Analysis error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
🤖 Scrum Master Agent is running!
   
   Dashboard: http://localhost:${PORT}
   Health:    http://localhost:${PORT}/api/health
   
   JIRA: ${JIRA_CONFIG.host}/projects/${JIRA_CONFIG.projectKey}
   AI:   ${CLAUDE_API_KEY ? 'Enabled' : 'Disabled (set CLAUDE_API_KEY)'}
  `);
});
