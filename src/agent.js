/**
 * Agent Analyzer
 * Uses Claude AI to analyze sprint data with customizable prompts
 */

class AgentAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Analyze sprint data using Claude
   */
  async analyze(sprintData, prompt) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `${prompt}

Here is the sprint data to analyze:

Sprint: ${JSON.stringify(sprintData.sprint, null, 2)}

Metrics:
- Total Issues: ${sprintData.metrics.issueCount}
- Completion Rate: ${sprintData.metrics.completionRate.toFixed(1)}%
- Points Done: ${sprintData.metrics.pointsByStatus.done}
- Points In Progress: ${sprintData.metrics.pointsByStatus.inProgress}
- Points Blocked: ${sprintData.metrics.pointsByStatus.blocked}
- Points To Do: ${sprintData.metrics.pointsByStatus.todo}

Team Members: ${sprintData.team.map(t => t.name).join(', ')}

Issues:
${sprintData.issues.map(i => `- ${i.id}: ${i.title} [${i.status}] (${i.points || 0} pts) - ${i.assignee?.name || 'Unassigned'}`).join('\n')}

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
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Agent analysis error:', error);
      
      // Return fallback analysis
      return this.fallbackAnalysis(sprintData);
    }
  }

  /**
   * Fallback rule-based analysis if AI fails
   */
  fallbackAnalysis(sprintData) {
    const { metrics, issues } = sprintData;
    const risks = [];
    const recommendations = [];

    // Check for blocked items
    const blockedIssues = issues.filter(i => i.status.toLowerCase().includes('block'));
    if (blockedIssues.length > 0) {
      risks.push({
        severity: 'high',
        title: 'Blocked Work Items',
        description: `${blockedIssues.length} item(s) are blocked`,
        tickets: blockedIssues.map(i => i.id)
      });
      recommendations.push({
        priority: 1,
        action: 'Resolve blockers immediately',
        detail: `Escalate blocked items: ${blockedIssues.map(i => i.id).join(', ')}`,
        tickets: blockedIssues.map(i => i.id)
      });
    }

    // Check completion rate
    if (metrics.completionRate < 50 && sprintData.sprint.daysRemaining < 5) {
      risks.push({
        severity: 'high',
        title: 'Sprint at Risk',
        description: `Only ${metrics.completionRate.toFixed(0)}% complete with ${sprintData.sprint.daysRemaining} days remaining`
      });
      recommendations.push({
        priority: 2,
        action: 'Consider scope reduction',
        detail: 'Review backlog and move low-priority items to next sprint'
      });
    }

    // Check for unassigned work
    const unassigned = issues.filter(i => !i.assignee && !i.status.toLowerCase().includes('done'));
    if (unassigned.length > 0) {
      risks.push({
        severity: 'medium',
        title: 'Unassigned Work',
        description: `${unassigned.length} item(s) have no assignee`,
        tickets: unassigned.map(i => i.id)
      });
    }

    const summary = `Sprint is ${metrics.completionRate.toFixed(0)}% complete with ${sprintData.sprint.daysRemaining} days remaining. ${issues.length} total issues, ${blockedIssues.length} blocked.`;

    return {
      summary,
      risks,
      recommendations,
      isAI: false
    };
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentAnalyzer;
}
