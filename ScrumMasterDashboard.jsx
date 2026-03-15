import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Users, TrendingUp, Zap, RefreshCw, Brain, ChevronRight, AlertCircle, Target, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

// ============================================================================
// MOCK JIRA DATA LAYER
// Replace this section with real JIRA API calls when ready for production
// ============================================================================

const MOCK_TEAM = [
  { id: 'user-1', name: 'Alice Chen', avatar: '👩‍💻', role: 'Senior Developer' },
  { id: 'user-2', name: 'Bob Martinez', avatar: '👨‍💻', role: 'Developer' },
  { id: 'user-3', name: 'Carol Singh', avatar: '👩‍🔬', role: 'QA Engineer' },
  { id: 'user-4', name: 'David Kim', avatar: '🧑‍💻', role: 'Developer' },
];

const MOCK_SPRINT = {
  id: 'sprint-42',
  name: 'Sprint 42 - User Authentication',
  goal: 'Complete OAuth2 integration and password reset flow',
  startDate: '2026-03-02',
  endDate: '2026-03-13',
  daysRemaining: 3,
  totalDays: 10,
  committedPoints: 34,
  completedPoints: 21,
  velocity: {
    current: 21,
    average: 28,
    last3Sprints: [26, 30, 28],
  },
};

const MOCK_TICKETS = [
  // Completed
  { id: 'PROJ-101', title: 'Setup OAuth2 provider configuration', status: 'Done', points: 3, assignee: 'user-1', type: 'task', daysInStatus: 0, blockedBy: null, priority: 'Medium' },
  { id: 'PROJ-102', title: 'Implement login endpoint', status: 'Done', points: 5, assignee: 'user-2', type: 'story', daysInStatus: 0, blockedBy: null, priority: 'High' },
  { id: 'PROJ-103', title: 'Create login UI components', status: 'Done', points: 5, assignee: 'user-4', type: 'story', daysInStatus: 0, blockedBy: null, priority: 'High' },
  { id: 'PROJ-104', title: 'Write unit tests for auth service', status: 'Done', points: 3, assignee: 'user-3', type: 'task', daysInStatus: 0, blockedBy: null, priority: 'Medium' },
  { id: 'PROJ-105', title: 'Token refresh mechanism', status: 'Done', points: 5, assignee: 'user-1', type: 'story', daysInStatus: 0, blockedBy: null, priority: 'High' },
  
  // In Progress
  { id: 'PROJ-106', title: 'Password reset email template', status: 'In Progress', points: 2, assignee: 'user-4', type: 'task', daysInStatus: 2, blockedBy: null, priority: 'Medium' },
  { id: 'PROJ-107', title: 'Password reset API endpoint', status: 'In Progress', points: 5, assignee: 'user-2', type: 'story', daysInStatus: 3, blockedBy: null, priority: 'High' },
  { id: 'PROJ-108', title: 'Security audit for auth flow', status: 'In Progress', points: 3, assignee: 'user-1', type: 'task', daysInStatus: 1, blockedBy: null, priority: 'Critical' },
  
  // Blocked
  { id: 'PROJ-109', title: 'Integration tests with OAuth provider', status: 'Blocked', points: 3, assignee: 'user-3', type: 'task', daysInStatus: 4, blockedBy: 'Waiting for sandbox credentials from vendor', priority: 'High' },
  
  // To Do (not started)
  { id: 'PROJ-110', title: 'Password strength validation', status: 'To Do', points: 2, assignee: 'user-4', type: 'task', daysInStatus: 0, blockedBy: null, priority: 'Medium' },
  { id: 'PROJ-111', title: 'Rate limiting for auth endpoints', status: 'To Do', points: 3, assignee: 'user-2', type: 'story', daysInStatus: 0, blockedBy: null, priority: 'High' },
  { id: 'PROJ-112', title: 'Session management documentation', status: 'To Do', points: 2, assignee: 'user-1', type: 'task', daysInStatus: 0, blockedBy: null, priority: 'Low' },
  
  // Added mid-sprint (scope creep indicator)
  { id: 'PROJ-113', title: '[URGENT] Fix XSS vulnerability in login form', status: 'In Progress', points: 2, assignee: 'user-1', type: 'bug', daysInStatus: 1, blockedBy: null, priority: 'Critical', addedMidSprint: true },
];

const MOCK_BURNDOWN = [
  { day: 'Mar 2', ideal: 34, actual: 34 },
  { day: 'Mar 3', ideal: 30.6, actual: 34 },
  { day: 'Mar 4', ideal: 27.2, actual: 31 },
  { day: 'Mar 5', ideal: 23.8, actual: 26 },
  { day: 'Mar 6', ideal: 20.4, actual: 21 },
  { day: 'Mar 9', ideal: 17, actual: 18 },
  { day: 'Mar 10', ideal: 13.6, actual: 13 },
  { day: 'Mar 11', ideal: 10.2, actual: null },
  { day: 'Mar 12', ideal: 6.8, actual: null },
  { day: 'Mar 13', ideal: 3.4, actual: null },
];

// ============================================================================
// AGENT ANALYSIS ENGINE
// This is where Claude AI analyzes the sprint data
// ============================================================================

const analyzeSprintWithAgent = async (sprint, tickets, team) => {
  // Prepare context for the agent
  const sprintContext = {
    sprint,
    tickets,
    team,
    metrics: calculateMetrics(sprint, tickets),
  };

  // In production, this calls Claude API
  // For now, we use intelligent rule-based analysis that mimics agent behavior
  return generateAgentInsights(sprintContext);
};

const calculateMetrics = (sprint, tickets) => {
  const byStatus = {
    done: tickets.filter(t => t.status === 'Done'),
    inProgress: tickets.filter(t => t.status === 'In Progress'),
    blocked: tickets.filter(t => t.status === 'Blocked'),
    todo: tickets.filter(t => t.status === 'To Do'),
  };

  const pointsByStatus = {
    done: byStatus.done.reduce((sum, t) => sum + t.points, 0),
    inProgress: byStatus.inProgress.reduce((sum, t) => sum + t.points, 0),
    blocked: byStatus.blocked.reduce((sum, t) => sum + t.points, 0),
    todo: byStatus.todo.reduce((sum, t) => sum + t.points, 0),
  };

  const completionRate = (pointsByStatus.done / sprint.committedPoints) * 100;
  const remainingPoints = sprint.committedPoints - pointsByStatus.done;
  const pointsPerDay = remainingPoints / sprint.daysRemaining;
  const requiredVelocity = pointsPerDay * sprint.totalDays;
  
  const scopeCreep = tickets.filter(t => t.addedMidSprint);
  const stalledTickets = tickets.filter(t => t.status === 'In Progress' && t.daysInStatus >= 3);
  const criticalItems = tickets.filter(t => t.priority === 'Critical' && t.status !== 'Done');

  return {
    byStatus,
    pointsByStatus,
    completionRate,
    remainingPoints,
    pointsPerDay,
    requiredVelocity,
    scopeCreep,
    stalledTickets,
    criticalItems,
    isOnTrack: requiredVelocity <= sprint.velocity.average * 1.1,
  };
};

const generateAgentInsights = (context) => {
  const { sprint, tickets, metrics } = context;
  const insights = [];
  const risks = [];
  const recommendations = [];

  // Risk: Blocked items
  if (metrics.byStatus.blocked.length > 0) {
    risks.push({
      severity: 'high',
      title: 'Blocked Work Items',
      description: `${metrics.byStatus.blocked.length} ticket(s) blocked, totaling ${metrics.pointsByStatus.blocked} points`,
      items: metrics.byStatus.blocked.map(t => ({
        id: t.id,
        title: t.title,
        reason: t.blockedBy,
      })),
    });
    recommendations.push({
      priority: 1,
      action: 'Escalate blocker for ' + metrics.byStatus.blocked[0].id,
      detail: `Contact vendor for sandbox credentials immediately. This is blocking ${metrics.pointsByStatus.blocked} points of work.`,
    });
  }

  // Risk: Stalled tickets
  if (metrics.stalledTickets.length > 0) {
    risks.push({
      severity: 'medium',
      title: 'Stalled Progress',
      description: `${metrics.stalledTickets.length} ticket(s) in progress for 3+ days without movement`,
      items: metrics.stalledTickets.map(t => ({
        id: t.id,
        title: t.title,
        daysStalled: t.daysInStatus,
      })),
    });
    recommendations.push({
      priority: 2,
      action: 'Check in on stalled work',
      detail: `PROJ-107 has been in progress for ${metrics.stalledTickets[0]?.daysInStatus || 3} days. Consider pairing or breaking down the task.`,
    });
  }

  // Risk: Scope creep
  if (metrics.scopeCreep.length > 0) {
    const addedPoints = metrics.scopeCreep.reduce((sum, t) => sum + t.points, 0);
    risks.push({
      severity: 'medium',
      title: 'Scope Creep Detected',
      description: `${metrics.scopeCreep.length} item(s) added mid-sprint (+${addedPoints} points)`,
      items: metrics.scopeCreep.map(t => ({
        id: t.id,
        title: t.title,
        points: t.points,
      })),
    });
  }

  // Risk: Critical items not done
  if (metrics.criticalItems.length > 0) {
    risks.push({
      severity: 'high',
      title: 'Critical Items at Risk',
      description: `${metrics.criticalItems.length} critical priority item(s) not yet completed`,
      items: metrics.criticalItems.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
      })),
    });
  }

  // Sprint health insight
  const healthScore = calculateHealthScore(metrics);
  insights.push({
    type: 'health',
    title: 'Sprint Health',
    score: healthScore,
    summary: healthScore >= 70 
      ? 'Sprint is progressing well with manageable risks'
      : healthScore >= 50
      ? 'Sprint has some concerns that need attention'
      : 'Sprint is at risk and needs immediate intervention',
  });

  // Velocity insight
  const velocityTrend = sprint.velocity.current / sprint.velocity.average;
  insights.push({
    type: 'velocity',
    title: 'Velocity Analysis',
    current: sprint.velocity.current,
    average: sprint.velocity.average,
    trend: velocityTrend >= 1 ? 'above' : velocityTrend >= 0.8 ? 'on-track' : 'below',
    summary: `Current velocity is ${Math.round(velocityTrend * 100)}% of team average. ${
      metrics.isOnTrack 
        ? 'On track to complete sprint commitment.'
        : 'May not complete all committed work.'
    }`,
  });

  // Timeline projection
  const projectedCompletion = metrics.isOnTrack 
    ? 'March 13 (on time)'
    : 'March 15 (2 days late)';
  insights.push({
    type: 'timeline',
    title: 'Completion Projection',
    projectedDate: projectedCompletion,
    confidence: metrics.isOnTrack ? 'high' : 'medium',
    summary: metrics.isOnTrack
      ? `Based on current velocity, team will complete ${sprint.committedPoints - metrics.pointsByStatus.todo} of ${sprint.committedPoints} points by sprint end.`
      : `Team needs to increase velocity by ${Math.round((metrics.requiredVelocity / sprint.velocity.average - 1) * 100)}% to meet commitment. Consider descoping ${metrics.pointsByStatus.todo} points.`,
  });

  // Daily standup summary
  const standupSummary = {
    done: metrics.byStatus.done.slice(-3).map(t => t.title),
    inProgress: metrics.byStatus.inProgress.map(t => `${t.title} (${t.assignee})`),
    blockers: metrics.byStatus.blocked.map(t => `${t.title}: ${t.blockedBy}`),
  };

  // Recommendations
  if (!metrics.isOnTrack) {
    recommendations.push({
      priority: 3,
      action: 'Consider descoping',
      detail: `Remove PROJ-112 (Session documentation, 2 points) from sprint to increase completion probability.`,
    });
  }

  recommendations.push({
    priority: recommendations.length + 1,
    action: 'Focus on critical path',
    detail: 'Prioritize PROJ-108 (Security audit) completion before any new work starts.',
  });

  return {
    insights,
    risks,
    recommendations,
    standupSummary,
    healthScore,
    generatedAt: new Date().toISOString(),
  };
};

const calculateHealthScore = (metrics) => {
  let score = 100;
  
  // Deduct for blocked items
  score -= metrics.byStatus.blocked.length * 10;
  
  // Deduct for stalled items
  score -= metrics.stalledTickets.length * 5;
  
  // Deduct for scope creep
  score -= metrics.scopeCreep.length * 5;
  
  // Deduct for critical items not done
  score -= metrics.criticalItems.length * 8;
  
  // Deduct if behind on velocity
  if (!metrics.isOnTrack) score -= 15;
  
  return Math.max(0, Math.min(100, score));
};

// ============================================================================
// DASHBOARD COMPONENTS
// ============================================================================

const StatusBadge = ({ status }) => {
  const styles = {
    'Done': 'bg-emerald-100 text-emerald-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    'Blocked': 'bg-red-100 text-red-800',
    'To Do': 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const styles = {
    'Critical': 'bg-red-500 text-white',
    'High': 'bg-orange-100 text-orange-800',
    'Medium': 'bg-yellow-100 text-yellow-800',
    'Low': 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[priority]}`}>
      {priority}
    </span>
  );
};

const MetricCard = ({ icon: Icon, title, value, subtitle, trend, color = 'blue' }) => {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorStyles[color]}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {subtitle}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
      </div>
    </div>
  );
};

const RiskCard = ({ risk }) => {
  const severityStyles = {
    high: 'border-l-red-500 bg-red-50',
    medium: 'border-l-amber-500 bg-amber-50',
    low: 'border-l-blue-500 bg-blue-50',
  };
  
  return (
    <div className={`border-l-4 ${severityStyles[risk.severity]} rounded-r-lg p-4 mb-3`}>
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className={risk.severity === 'high' ? 'text-red-600' : 'text-amber-600'} />
        <h4 className="font-semibold text-gray-900">{risk.title}</h4>
      </div>
      <p className="text-sm text-gray-700 mb-2">{risk.description}</p>
      {risk.items && risk.items.length > 0 && (
        <div className="space-y-1">
          {risk.items.map((item, idx) => (
            <div key={idx} className="text-xs text-gray-600 flex items-center gap-1">
              <ChevronRight size={12} />
              <span className="font-mono">{item.id}</span>: {item.title || item.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RecommendationCard = ({ rec }) => (
  <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg mb-2">
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
      {rec.priority}
    </div>
    <div>
      <h4 className="font-medium text-gray-900">{rec.action}</h4>
      <p className="text-sm text-gray-600 mt-0.5">{rec.detail}</p>
    </div>
  </div>
);

const HealthGauge = ({ score }) => {
  const getColor = (s) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';
  const getLabel = (s) => s >= 70 ? 'Healthy' : s >= 50 ? 'At Risk' : 'Critical';
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
          <circle 
            cx="64" cy="64" r="56" 
            stroke={getColor(score)} 
            strokeWidth="12" 
            fill="none"
            strokeDasharray={`${(score / 100) * 352} 352`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <span className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${
        score >= 70 ? 'bg-emerald-100 text-emerald-800' : 
        score >= 50 ? 'bg-amber-100 text-amber-800' : 
        'bg-red-100 text-red-800'
      }`}>
        {getLabel(score)}
      </span>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function ScrumMasterDashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    // Initial analysis on mount
    runAnalysis();
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    const result = await analyzeSprintWithAgent(MOCK_SPRINT, MOCK_TICKETS, MOCK_TEAM);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const metrics = calculateMetrics(MOCK_SPRINT, MOCK_TICKETS);
  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#9ca3af'];

  const pieData = [
    { name: 'Done', value: metrics.pointsByStatus.done },
    { name: 'In Progress', value: metrics.pointsByStatus.inProgress },
    { name: 'Blocked', value: metrics.pointsByStatus.blocked },
    { name: 'To Do', value: metrics.pointsByStatus.todo },
  ];

  const teamWorkload = MOCK_TEAM.map(member => ({
    name: member.name.split(' ')[0],
    avatar: member.avatar,
    points: MOCK_TICKETS.filter(t => t.assignee === member.id).reduce((sum, t) => sum + t.points, 0),
    tickets: MOCK_TICKETS.filter(t => t.assignee === member.id).length,
    done: MOCK_TICKETS.filter(t => t.assignee === member.id && t.status === 'Done').length,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <Brain className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Scrum Master Agent</h1>
                <p className="text-sm text-gray-500">{MOCK_SPRINT.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Sprint ends in</p>
                <p className="text-lg font-bold text-gray-900">{MOCK_SPRINT.daysRemaining} days</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {['overview', 'tickets', 'team', 'standup'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard 
                icon={Target} 
                title="Sprint Progress" 
                value={`${Math.round(metrics.completionRate)}%`}
                subtitle={`${metrics.pointsByStatus.done}/${MOCK_SPRINT.committedPoints} pts`}
                color="blue"
              />
              <MetricCard 
                icon={TrendingUp} 
                title="Current Velocity" 
                value={MOCK_SPRINT.velocity.current}
                subtitle={`avg: ${MOCK_SPRINT.velocity.average}`}
                trend={MOCK_SPRINT.velocity.current >= MOCK_SPRINT.velocity.average ? 'up' : 'down'}
                color="green"
              />
              <MetricCard 
                icon={AlertCircle} 
                title="Blocked Items" 
                value={metrics.byStatus.blocked.length}
                subtitle={`${metrics.pointsByStatus.blocked} pts at risk`}
                color={metrics.byStatus.blocked.length > 0 ? 'red' : 'green'}
              />
              <MetricCard 
                icon={Clock} 
                title="Days Remaining" 
                value={MOCK_SPRINT.daysRemaining}
                subtitle={`of ${MOCK_SPRINT.totalDays} days`}
                color="purple"
              />
            </div>

            {/* Charts + Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Burndown Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Sprint Burndown</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={MOCK_BURNDOWN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ideal" stroke="#9ca3af" strokeDasharray="5 5" dot={false} name="Ideal" />
                    <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Actual" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Health Score */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                <h3 className="font-semibold text-gray-900 mb-4">Sprint Health</h3>
                {analysis && <HealthGauge score={analysis.healthScore} />}
                {!analysis && <div className="text-gray-400">Run analysis to see health</div>}
              </div>
            </div>

            {/* AI Insights + Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risks */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-500" size={20} />
                  <h3 className="font-semibold text-gray-900">Risks & Blockers</h3>
                </div>
                {analysis?.risks.length > 0 ? (
                  analysis.risks.map((risk, idx) => <RiskCard key={idx} risk={risk} />)
                ) : (
                  <p className="text-gray-500 text-sm">No major risks detected</p>
                )}
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="text-indigo-500" size={20} />
                  <h3 className="font-semibold text-gray-900">Agent Recommendations</h3>
                </div>
                {analysis?.recommendations.length > 0 ? (
                  analysis.recommendations.map((rec, idx) => <RecommendationCard key={idx} rec={rec} />)
                ) : (
                  <p className="text-gray-500 text-sm">Run analysis to get recommendations</p>
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Points by Status</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Team Workload</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={teamWorkload} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip />
                    <Bar dataKey="points" fill="#6366f1" radius={[0, 4, 4, 0]} name="Points" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Points</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_TICKETS.map(ticket => {
                  const assignee = MOCK_TEAM.find(m => m.id === ticket.assignee);
                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-indigo-600">{ticket.id}</span>
                        {ticket.addedMidSprint && (
                          <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">NEW</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.title}</td>
                      <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ticket.points}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{assignee?.avatar}</span>
                          <span className="text-sm text-gray-700">{assignee?.name.split(' ')[0]}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MOCK_TEAM.map(member => {
              const memberTickets = MOCK_TICKETS.filter(t => t.assignee === member.id);
              const memberPoints = memberTickets.reduce((sum, t) => sum + t.points, 0);
              const donePoints = memberTickets.filter(t => t.status === 'Done').reduce((sum, t) => sum + t.points, 0);
              
              return (
                <div key={member.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{member.avatar}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{memberTickets.length}</p>
                      <p className="text-xs text-gray-500">Tickets</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{memberPoints}</p>
                      <p className="text-xs text-gray-500">Points</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-600">{Math.round((donePoints / memberPoints) * 100) || 0}%</p>
                      <p className="text-xs text-gray-500">Complete</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {memberTickets.slice(0, 3).map(ticket => (
                      <div key={ticket.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-indigo-600">{ticket.id}</span>
                        <StatusBadge status={ticket.status} />
                      </div>
                    ))}
                    {memberTickets.length > 3 && (
                      <p className="text-xs text-gray-400">+{memberTickets.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'standup' && analysis && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar size={24} />
                <h2 className="text-xl font-bold">Daily Standup Summary</h2>
              </div>
              <p className="text-indigo-100">Generated by Scrum Master Agent • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="text-emerald-500" size={20} />
                  <h3 className="font-semibold text-gray-900">What was completed</h3>
                </div>
                <ul className="space-y-2">
                  {analysis.standupSummary.done.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="text-blue-500" size={20} />
                  <h3 className="font-semibold text-gray-900">What's in progress</h3>
                </div>
                <ul className="space-y-2">
                  {analysis.standupSummary.inProgress.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {analysis.standupSummary.blockers.length > 0 && (
                <div className="bg-white rounded-xl p-5 shadow-sm border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="text-red-500" size={20} />
                    <h3 className="font-semibold text-gray-900">Blockers</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.standupSummary.blockers.map((item, idx) => (
                      <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-500 mt-1">⚠</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>Scrum Master Agent v1.0 • Using mock JIRA data • Ready for production integration</p>
          {analysis && (
            <p className="mt-1">Last analysis: {new Date(analysis.generatedAt).toLocaleTimeString()}</p>
          )}
        </div>
      </footer>
    </div>
  );
}
