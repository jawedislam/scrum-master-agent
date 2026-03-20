<?php
/**
 * Scrum Master Agent - PHP API v2.0
 * Now with Chat functionality
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (file_exists('config.php')) {
    require_once 'config.php';
} else {
    echo json_encode(['error' => 'Configuration file not found.']);
    exit();
}

$endpoint = $_GET['endpoint'] ?? 'health';

/**
 * Make a request to JIRA API
 */
function jiraRequest($path, $isAgile = false, $method = 'GET', $postData = null) {
    $baseUrl = JIRA_HOST . ($isAgile ? '/rest/agile/1.0' : '/rest/api/3') . $path;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $baseUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Basic ' . base64_encode(JIRA_EMAIL . ':' . JIRA_API_TOKEN),
        'Accept: application/json',
        'Content-Type: application/json'
    ]);
    
    if ($method === 'POST' && $postData) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("JIRA API error: HTTP $httpCode - " . $response);
    }
    
    return json_decode($response, true);
}

/**
 * Search issues using new /search/jql endpoint
 */
function searchIssues($jql, $fields = [], $maxResults = 100) {
    $postData = [
        'jql' => $jql,
        'maxResults' => $maxResults,
        'fields' => $fields
    ];
    
    return jiraRequest('/search/jql', false, 'POST', $postData);
}

/**
 * Chat with Claude - conversational Scrum Master
 */
function chatWithClaude($message, $sprintData, $personality, $chatHistory = []) {
    if (!defined('CLAUDE_API_KEY') || empty(CLAUDE_API_KEY)) {
        return ['error' => 'Claude API key not configured'];
    }
    
    // Personality prompts
    $personalities = [
        'strict' => "You are a strict, by-the-book scrum master. Be direct, flag all risks and deviations, reference ticket IDs. Push back on scope creep.",
        'coach' => "You are a supportive agile coach. Celebrate wins, focus on team wellbeing, be encouraging but honest. Reference team members by name.",
        'executive' => "You are an executive reporter. Be concise, lead with bottom line, use business language. Focus on metrics and outcomes."
    ];
    
    $systemPrompt = $personalities[$personality] ?? $personalities['coach'];
    
    // Build system message with sprint context
    $systemMessage = $systemPrompt . "\n\n";
    $systemMessage .= "You have access to the current sprint data. Here's the context:\n\n";
    $systemMessage .= "SPRINT: " . ($sprintData['sprint']['name'] ?? 'Current Sprint') . "\n";
    $systemMessage .= "Days Remaining: " . ($sprintData['sprint']['daysRemaining'] ?? 'Unknown') . "\n";
    $systemMessage .= "Total Issues: " . ($sprintData['metrics']['issueCount'] ?? 0) . "\n";
    $systemMessage .= "Completion Rate: " . round($sprintData['metrics']['completionRate'] ?? 0) . "%\n";
    $systemMessage .= "Done: " . ($sprintData['metrics']['byStatus']['done'] ?? 0) . " issues\n";
    $systemMessage .= "In Progress: " . ($sprintData['metrics']['byStatus']['inProgress'] ?? 0) . " issues\n";
    $systemMessage .= "Blocked: " . ($sprintData['metrics']['byStatus']['blocked'] ?? 0) . " issues\n";
    $systemMessage .= "To Do: " . ($sprintData['metrics']['byStatus']['todo'] ?? 0) . " issues\n\n";
    
    // Add team info
    if (!empty($sprintData['team'])) {
        $systemMessage .= "TEAM MEMBERS:\n";
        foreach ($sprintData['team'] as $member) {
            $memberIssues = array_filter($sprintData['issues'], function($i) use ($member) {
                return isset($i['assignee']['id']) && $i['assignee']['id'] === $member['id'];
            });
            $memberDone = array_filter($memberIssues, function($i) {
                return stripos($i['status'], 'done') !== false;
            });
            $systemMessage .= "- " . $member['name'] . ": " . count($memberIssues) . " issues assigned, " . count($memberDone) . " done\n";
        }
        $systemMessage .= "\n";
    }
    
    // Add issue details
    $systemMessage .= "ISSUES:\n";
    foreach ($sprintData['issues'] as $issue) {
        $assignee = $issue['assignee']['name'] ?? 'Unassigned';
        $systemMessage .= "- [{$issue['id']}] {$issue['title']} | Status: {$issue['status']} | Assignee: {$assignee} | Points: " . ($issue['points'] ?? 0) . "\n";
    }
    
    $systemMessage .= "\nRespond conversationally and helpfully. Keep responses concise but informative. If asked about team performance, be constructive and supportive. Reference specific ticket IDs when relevant.";
    
    // Build messages array
    $messages = [];
    
    // Add chat history
    foreach ($chatHistory as $historyMsg) {
        $messages[] = [
            'role' => $historyMsg['role'],
            'content' => $historyMsg['content']
        ];
    }
    
    // Add current message
    $messages[] = [
        'role' => 'user',
        'content' => $message
    ];
    
    $payload = [
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 1000,
        'system' => $systemMessage,
        'messages' => $messages
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.anthropic.com/v1/messages');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . CLAUDE_API_KEY,
        'anthropic-version: 2023-06-01'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return ['error' => 'Claude API error: HTTP ' . $httpCode];
    }
    
    $data = json_decode($response, true);
    $text = $data['content'][0]['text'] ?? 'Sorry, I could not process that request.';
    
    return ['message' => $text];
}

/**
 * Legacy analyze function for dashboard analysis
 */
function claudeRequest($prompt, $sprintData) {
    if (!defined('CLAUDE_API_KEY') || empty(CLAUDE_API_KEY)) {
        return null;
    }
    
    $payload = [
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 1500,
        'messages' => [[
            'role' => 'user',
            'content' => $prompt . "\n\nSprint data:\n" . json_encode($sprintData, JSON_PRETTY_PRINT) . "\n\nRespond with JSON only."
        ]]
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.anthropic.com/v1/messages');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . CLAUDE_API_KEY,
        'anthropic-version: 2023-06-01'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $text = $data['content'][0]['text'] ?? '';
    $text = preg_replace('/```json|```/', '', $text);
    
    return json_decode(trim($text), true);
}

try {
    switch ($endpoint) {
        case 'health':
            echo json_encode([
                'status' => 'ok',
                'timestamp' => date('c'),
                'version' => '2.0',
                'jiraConfigured' => defined('JIRA_EMAIL') && !empty(JIRA_EMAIL),
                'claudeConfigured' => defined('CLAUDE_API_KEY') && !empty(CLAUDE_API_KEY)
            ]);
            break;
            
        case 'config':
            echo json_encode([
                'jiraHost' => JIRA_HOST,
                'projectKey' => JIRA_PROJECT_KEY,
                'aiEnabled' => defined('CLAUDE_API_KEY') && !empty(CLAUDE_API_KEY)
            ]);
            break;
            
        case 'sprint-data':
            $jql = 'project = ' . JIRA_PROJECT_KEY . ' ORDER BY created DESC';
            $fields = ['summary', 'status', 'priority', 'assignee', 'customfield_10016', 'description', 'labels', 'issuetype', 'created', 'updated'];
            
            $issuesData = searchIssues($jql, $fields, 100);
            
            $issues = [];
            $team = [];
            $seenIds = [];
            
            foreach ($issuesData['issues'] as $issue) {
                $assignee = null;
                if (isset($issue['fields']['assignee']) && $issue['fields']['assignee']) {
                    $assignee = [
                        'id' => $issue['fields']['assignee']['accountId'],
                        'name' => $issue['fields']['assignee']['displayName'],
                        'email' => $issue['fields']['assignee']['emailAddress'] ?? '',
                        'avatar' => $issue['fields']['assignee']['avatarUrls']['48x48'] ?? ''
                    ];
                    
                    if (!in_array($assignee['id'], $seenIds)) {
                        $seenIds[] = $assignee['id'];
                        $team[] = $assignee;
                    }
                }
                
                $issues[] = [
                    'id' => $issue['key'],
                    'title' => $issue['fields']['summary'],
                    'status' => $issue['fields']['status']['name'] ?? 'Unknown',
                    'priority' => $issue['fields']['priority']['name'] ?? 'Medium',
                    'assignee' => $assignee,
                    'points' => $issue['fields']['customfield_10016'] ?? 0,
                    'type' => $issue['fields']['issuetype']['name'] ?? 'Task',
                    'labels' => $issue['fields']['labels'] ?? []
                ];
            }
            
            $byStatus = ['done' => 0, 'inProgress' => 0, 'blocked' => 0, 'todo' => 0];
            $pointsByStatus = ['done' => 0, 'inProgress' => 0, 'blocked' => 0, 'todo' => 0];
            
            foreach ($issues as $issue) {
                $status = strtolower($issue['status']);
                $points = $issue['points'] ?: 0;
                
                if (strpos($status, 'done') !== false) {
                    $byStatus['done']++;
                    $pointsByStatus['done'] += $points;
                } elseif (strpos($status, 'progress') !== false) {
                    $byStatus['inProgress']++;
                    $pointsByStatus['inProgress'] += $points;
                } elseif (strpos($status, 'block') !== false) {
                    $byStatus['blocked']++;
                    $pointsByStatus['blocked'] += $points;
                } else {
                    $byStatus['todo']++;
                    $pointsByStatus['todo'] += $points;
                }
            }
            
            $totalPoints = array_sum($pointsByStatus);
            $completionRate = $totalPoints > 0 ? ($pointsByStatus['done'] / $totalPoints) * 100 : 0;
            
            $sprint = [
                'id' => 'default',
                'name' => 'Current Sprint',
                'totalDays' => 14,
                'daysRemaining' => 7
            ];
            
            try {
                $boards = jiraRequest('/board?projectKeyOrId=' . JIRA_PROJECT_KEY, true);
                if (!empty($boards['values'])) {
                    $boardId = $boards['values'][0]['id'];
                    $sprints = jiraRequest('/board/' . $boardId . '/sprint?state=active,future', true);
                    if (!empty($sprints['values'])) {
                        $s = $sprints['values'][0];
                        $startDate = $s['startDate'] ? strtotime($s['startDate']) : time();
                        $endDate = $s['endDate'] ? strtotime($s['endDate']) : time() + (14 * 86400);
                        $sprint = [
                            'id' => $s['id'],
                            'name' => $s['name'],
                            'state' => $s['state'],
                            'totalDays' => ceil(($endDate - $startDate) / 86400),
                            'daysRemaining' => max(0, ceil(($endDate - time()) / 86400))
                        ];
                    }
                }
            } catch (Exception $e) {
                // Use default sprint
            }
            
            echo json_encode([
                'sprint' => $sprint,
                'issues' => $issues,
                'team' => $team,
                'metrics' => [
                    'byStatus' => $byStatus,
                    'pointsByStatus' => $pointsByStatus,
                    'totalPoints' => $totalPoints,
                    'completionRate' => $completionRate,
                    'issueCount' => count($issues)
                ]
            ]);
            break;
            
        case 'chat':
            $input = json_decode(file_get_contents('php://input'), true);
            $message = $input['message'] ?? '';
            $sprintData = $input['sprintData'] ?? [];
            $personality = $input['personality'] ?? 'coach';
            $chatHistory = $input['chatHistory'] ?? [];
            
            if (empty($message)) {
                echo json_encode(['error' => 'No message provided']);
                break;
            }
            
            $result = chatWithClaude($message, $sprintData, $personality, $chatHistory);
            echo json_encode($result);
            break;
            
        case 'analyze':
            $input = json_decode(file_get_contents('php://input'), true);
            $result = claudeRequest($input['prompt'], $input['sprintData']);
            
            if ($result) {
                $result['isAI'] = true;
                echo json_encode($result);
            } else {
                echo json_encode(['error' => 'AI analysis not available']);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown endpoint']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
