<?php
/**
 * Scrum Master Agent - PHP API
 * 
 * This is a fallback API for shared hosting that doesn't support Node.js.
 * Place this file in your public_html/scrum-agent/ folder.
 * 
 * SETUP:
 * 1. Rename this file to api.php
 * 2. Create a config.php file with your credentials (see below)
 * 3. Make sure your hosting has PHP 7.4+ with cURL enabled
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load configuration
// Create a config.php file with:
// <?php
// define('JIRA_HOST', 'https://jawedislam85.atlassian.net');
// define('JIRA_EMAIL', 'your-email@example.com');
// define('JIRA_API_TOKEN', 'your-token');
// define('JIRA_PROJECT_KEY', 'SAT');
// define('CLAUDE_API_KEY', 'your-claude-key'); // optional

if (file_exists('config.php')) {
    require_once 'config.php';
} else {
    echo json_encode(['error' => 'Configuration file not found. Create config.php with your credentials.']);
    exit();
}

// Get the endpoint from the URL
$endpoint = $_GET['endpoint'] ?? 'health';

/**
 * Make a request to JIRA API
 */
function jiraRequest($path, $isAgile = false) {
    $baseUrl = JIRA_HOST . ($isAgile ? '/rest/agile/1.0' : '/rest/api/3') . $path;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $baseUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Basic ' . base64_encode(JIRA_EMAIL . ':' . JIRA_API_TOKEN),
        'Accept: application/json',
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("JIRA API error: HTTP $httpCode");
    }
    
    return json_decode($response, true);
}

/**
 * Make a request to Claude API
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
            // Fetch issues
            $jql = 'project = ' . JIRA_PROJECT_KEY . ' ORDER BY created DESC';
            $issuesData = jiraRequest('/search?jql=' . urlencode($jql) . '&maxResults=100&fields=summary,status,priority,assignee,customfield_10016,description,labels,issuetype,created,updated');
            
            $issues = [];
            $team = [];
            $seenIds = [];
            
            foreach ($issuesData['issues'] as $issue) {
                $assignee = null;
                if ($issue['fields']['assignee']) {
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
            
            // Calculate metrics
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
            
            // Try to get sprint info
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
