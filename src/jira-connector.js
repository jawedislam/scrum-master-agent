/**
 * JIRA Connector
 * Fetches sprint data from JIRA Cloud API
 */

class JiraConnector {
  constructor(config) {
    this.host = config.host;
    this.email = config.email;
    this.apiToken = config.apiToken;
    this.projectKey = config.projectKey;
    this.authHeader = 'Basic ' + btoa(`${this.email}:${this.apiToken}`);
  }

  async fetch(endpoint) {
    const response = await fetch(`${this.host}/rest/api/3${endpoint}`, {
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  async fetchAgile(endpoint) {
    const response = await fetch(`${this.host}/rest/agile/1.0${endpoint}`, {
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`JIRA Agile API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get all issues for the project
   */
  async getProjectIssues() {
    const jql = `project = ${this.projectKey} ORDER BY created DESC`;
    const data = await this.fetch(`/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,status,priority,assignee,customfield_10016,description,labels,issuetype,created,updated`);
    
    return data.issues.map(issue => ({
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
      points: issue.fields.customfield_10016 || 0, // Story Points field
      description: issue.fields.description,
      labels: issue.fields.labels || [],
      type: issue.fields.issuetype?.name || 'Task',
      created: issue.fields.created,
      updated: issue.fields.updated
    }));
  }

  /**
   * Get active sprint for the project
   */
  async getActiveSprint() {
    try {
      // First, get the board ID for this project
      const boards = await this.fetchAgile(`/board?projectKeyOrId=${this.projectKey}`);
      
      if (!boards.values || boards.values.length === 0) {
        return null;
      }
      
      const boardId = boards.values[0].id;
      
      // Get active sprint for this board
      const sprints = await this.fetchAgile(`/board/${boardId}/sprint?state=active`);
      
      if (!sprints.values || sprints.values.length === 0) {
        // Try to get future sprints if no active
        const futureSprints = await this.fetchAgile(`/board/${boardId}/sprint?state=future`);
        if (futureSprints.values && futureSprints.values.length > 0) {
          return this.formatSprint(futureSprints.values[0]);
        }
        return null;
      }
      
      return this.formatSprint(sprints.values[0]);
    } catch (error) {
      console.error('Error fetching sprint:', error);
      return null;
    }
  }

  formatSprint(sprint) {
    const startDate = sprint.startDate ? new Date(sprint.startDate) : new Date();
    const endDate = sprint.endDate ? new Date(sprint.endDate) : new Date();
    const today = new Date();
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    
    return {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal || '',
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      totalDays,
      daysRemaining
    };
  }

  /**
   * Get sprint issues with calculated metrics
   */
  async getSprintData() {
    const [issues, sprint] = await Promise.all([
      this.getProjectIssues(),
      this.getActiveSprint()
    ]);

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

    // Get unique assignees as team members
    const team = [];
    const seenIds = new Set();
    issues.forEach(issue => {
      if (issue.assignee && !seenIds.has(issue.assignee.id)) {
        seenIds.add(issue.assignee.id);
        team.push(issue.assignee);
      }
    });

    return {
      sprint: sprint || {
        id: 'default',
        name: 'Current Sprint',
        totalDays: 14,
        daysRemaining: 7
      },
      issues,
      team,
      metrics: {
        byStatus,
        pointsByStatus,
        totalPoints,
        completionRate,
        issueCount: issues.length
      }
    };
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JiraConnector;
}
