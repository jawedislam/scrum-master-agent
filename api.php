<?php
/**
 * Scrum Master Agent - PHP API v2.1
 * Now with Chat + Email functionality
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
 * Send email via Gmail SMTP (SSL on port 465)
 */
function sendEmail($to, $subject, $htmlBody, $textBody = '') {
    if (!defined('SMTP_EMAIL') || !defined('SMTP_PASSWORD')) {
        return ['error' => 'Email not configured. Add SMTP_EMAIL and SMTP_PASSWORD to config.php'];
    }
    
    $from = SMTP_EMAIL;
    $password = str_replace(' ', '', SMTP_PASSWORD); // Remove any spaces
    
    // Connect to SMTP server via SSL
    $socket = @fsockopen('ssl://smtp.gmail.com', 465, $errno, $errstr, 10);
    
    if (!$socket) {
        return ['error' => "Could not connect to SMTP server: $errstr"];
    }
    
    fgets($socket, 512); // greeting
    
    fputs($socket, "EHLO localhost\r\n");
    while ($line = fgets($socket, 512)) {
        if (strpos($line, '250 ') === 0) break;
    }
    
    // Authenticate
    fputs($socket, "AUTH LOGIN\r\n");
    fgets($socket, 512);
    
    fputs($socket, base64_encode(SMTP_EMAIL) . "\r\n");
    fgets($socket, 512);
    
    fputs($socket, base64_encode($password) . "\r\n");
    $authResponse = fgets($socket, 512);
    
    if (strpos($authResponse, '235') === false) {
        fclose($socket);
        return ['error' => 'SMTP authentication failed'];
    }
    
    // Send email
    fputs($socket, "MAIL FROM:<$from>\r\n");
    fgets($socket, 512);
    
    fputs($socket, "RCPT TO:<$to>\r\n");
    fgets($socket, 512);
    
    fputs($socket, "DATA\r\n");
    fgets($socket, 512);
    
    // Build message
    $message = "Subject: $subject\r\n";
    $message .= "From: Scrum Master Agent <$from>\r\n";
    $message .= "To: $to\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "\r\n";
    $message .= $htmlBody;
    $message .= "\r\n.\r\n";
    
    fputs($socket, $message);
    $dataResponse = fgets($socket, 512);
    
    fputs($socket, "QUIT\r\n");
    fclose($socket);
    
    if (strpos($dataResponse, '250') !== false) {
        return ['success' => true, 'message' => "Email sent to $to"];
    } else {
        return ['error' => 'Failed to send email'];
    }
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate($type, $data) {
    $styles = '
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
        .metric { display: inline-block; padding: 10px 15px; margin: 5px; background: white; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #4f46e5; }
        .metric-label { font-size: 12px; color: #6b7280; }
        .status-done { color: #059669; }
        .status-progress { color: #2563eb; }
        .status-blocked { color: #dc2626; }
        .issue { padding: 10px; background: white; margin: 5px 0; border-radius: 5px; border-left: 3px solid #4f46e5; }
    ';
    
    $html = '<!DOCTYPE html><html><head><style>' . $styles . '</style></head><body><div class="container">';
    
    switch ($type) {
        case 'standup':
            $html .= '<div class="header"><h2>📅 Daily Standup Summary</h2><p>' . date('l, F j, Y') . '</p></div>';
            $html .= '<div class="content">';
            $html .= '<h3>Sprint: ' . ($data['sprint']['name'] ?? 'Current Sprint') . '</h3>';
            
            // Metrics
            $html .= '<div style="text-align: center; margin: 20px 0;">';
            $html .= '<div class="metric"><div class="metric-value">' . round($data['metrics']['completionRate'] ?? 0) . '%</div><div class="metric-label">Complete</div></div>';
            $html .= '<div class="metric"><div class="metric-value">' . ($data['metrics']['byStatus']['inProgress'] ?? 0) . '</div><div class="metric-label">In Progress</div></div>';
            $html .= '<div class="metric"><div class="metric-value">' . ($data['metrics']['byStatus']['blocked'] ?? 0) . '</div><div class="metric-label">Blocked</div></div>';
            $html .= '<div class="metric"><div class="metric-value">' . ($data['sprint']['daysRemaining'] ?? 0) . '</div><div class="metric-label">Days Left</div></div>';
            $html .= '</div>';
            
            // In Progress
            $inProgress = array_filter($data['issues'], fn($i) => stripos($i['status'], 'progress') !== false);
            if (!empty($inProgress)) {
                $html .= '<h4>🔄 In Progress (' . count($inProgress) . ')</h4>';
                foreach (array_slice($inProgress, 0, 5) as $issue) {
                    $assignee = $issue['assignee']['name'] ?? 'Unassigned';
                    $html .= '<div class="issue"><strong>' . $issue['id'] . '</strong>: ' . $issue['title'] . ' <em>(' . $assignee . ')</em></div>';
                }
            }
            
            // Blocked
            $blocked = array_filter($data['issues'], fn($i) => stripos($i['status'], 'block') !== false);
            if (!empty($blocked)) {
                $html .= '<h4>🚫 Blocked (' . count($blocked) . ')</h4>';
                foreach ($blocked as $issue) {
                    $assignee = $issue['assignee']['name'] ?? 'Unassigned';
                    $html .= '<div class="issue" style="border-left-color: #dc2626;"><strong>' . $issue['id'] . '</strong>: ' . $issue['title'] . ' <em>(' . $assignee . ')</em></div>';
                }
            }
            
            $html .= '</div>';
            break;
            
        case 'health':
            $healthScore = 100;
            $healthScore -= ($data['metrics']['byStatus']['blocked'] ?? 0) * 15;
            $healthScore -= (100 - ($data['metrics']['completionRate'] ?? 0)) * 0.3;
            $healthScore = max(0, min(100, round($healthScore)));
            $healthStatus = $healthScore >= 70 ? 'Healthy 💚' : ($healthScore >= 50 ? 'At Risk 🟡' : 'Critical 🔴');
            
            $html .= '<div class="header"><h2>📊 Sprint Health Report</h2><p>' . ($data['sprint']['name'] ?? 'Current Sprint') . '</p></div>';
            $html .= '<div class="content">';
            $html .= '<div style="text-align: center; margin: 20px 0;"><div class="metric"><div class="metric-value">' . $healthScore . '</div><div class="metric-label">' . $healthStatus . '</div></div></div>';
            $html .= '<h4>Summary</h4><ul>';
            $html .= '<li>Completion: ' . round($data['metrics']['completionRate'] ?? 0) . '%</li>';
            $html .= '<li>Total Issues: ' . ($data['metrics']['issueCount'] ?? 0) . '</li>';
            $html .= '<li>Done: ' . ($data['metrics']['byStatus']['done'] ?? 0) . '</li>';
            $html .= '<li>In Progress: ' . ($data['metrics']['byStatus']['inProgress'] ?? 0) . '</li>';
            $html .= '<li>Blocked: ' . ($data['metrics']['byStatus']['blocked'] ?? 0) . '</li>';
            $html .= '<li>Days Remaining: ' . ($data['sprint']['daysRemaining'] ?? 0) . '</li>';
            $html .= '</ul></div>';
            break;
            
        case 'custom':
            $html .= '<div class="header"><h2>🤖 Message from Scrum Master Agent</h2></div>';
            $html .= '<div class="content">' . nl2br(htmlspecialchars($data['message'])) . '</div>';
            break;
    }
    
    $html .= '<div class="footer">Sent by Scrum Master Agent • <a href="https://scrum-master.intra-tech.co">View Dashboard</a></div>';
    $html .= '</div></body></html>';
    
    return $html;
}

/**
 * Chat with Claude - conversational Scrum Master
 */
function chatWithClaude($message, $sprintData, $personality, $chatHistory = []) {
    if (!defined('CLAUDE_API_KEY') || empty(CLAUDE_API_KEY)) {
        return ['error' => 'Claude API key not configured'];
    }
    
    $personalities = [
        'strict' => "You are a strict, by-the-book scrum master. Be direct, flag all risks and deviations, reference ticket IDs. Push back on scope creep.",
        'coach' => "You are a supportive agile coach. Celebrate wins, focus on team wellbeing, be encouraging but honest. Reference team members by name.",
        'executive' => "You are an executive reporter. Be concise, lead with bottom line, use business language. Focus on metrics and outcomes."
    ];
    
    $systemPrompt = $personalities[$personality] ?? $personalities['coach'];
    
    // Check if user wants to send an email
    $emailIntent = preg_match('/(send|email|notify|message|remind|alert).*(team|standup|update|report|health|summary)/i', $message);
    
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
    
    if (!empty($sprintData['team'])) {
        $systemMessage .= "TEAM MEMBERS:\n";
        foreach ($sprintData['team'] as $member) {
            $memberIssues = array_filter($sprintData['issues'], function($i) use ($member) {
                return isset($i['assignee']['id']) && $i['assignee']['id'] === $member['id'];
            });
            $memberDone = array_filter($memberIssues, function($i) {
                return stripos($i['status'], 'done') !== false;
            });
            $systemMessage .= "- " . $member['name'] . " (" . ($member['email'] ?? 'no email') . "): " . count($memberIssues) . " issues, " . count($memberDone) . " done\n";
        }
        $systemMessage .= "\n";
    }
    
    $systemMessage .= "ISSUES:\n";
    foreach ($sprintData['issues'] as $issue) {
        $assignee = $issue['assignee']['name'] ?? 'Unassigned';
        $systemMessage .= "- [{$issue['id']}] {$issue['title']} | Status: {$issue['status']} | Assignee: {$assignee} | Points: " . ($issue['points'] ?? 0) . "\n";
    }
    
    $systemMessage .= "\nYou can help send emails. If the user asks to send a message, email, or notification, respond with a JSON object like this:\n";
    $systemMessage .= '{"action":"send_email","emailType":"standup|health|custom","recipients":"all|email@example.com","customMessage":"optional message for custom type"}' . "\n";
    $systemMessage .= "Otherwise, respond conversationally and helpfully. Keep responses concise but informative.";
    
    $messages = [];
    foreach ($chatHistory as $historyMsg) {
        $messages[] = [
            'role' => $historyMsg['role'],
            'content' => $historyMsg['content']
        ];
    }
    $messages[] = ['role' => 'user', 'content' => $message];
    
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
    
    // Check if response contains email action
    if (preg_match('/\{[^}]*"action"\s*:\s*"send_email"[^}]*\}/s', $text, $matches)) {
        $actionData = json_decode($matches[0], true);
        if ($actionData && isset($actionData['action']) && $actionData['action'] === 'send_email') {
            return [
                'message' => $text,
                'emailAction' => $actionData
            ];
        }
    }
    
    return ['message' => $text];
}

/**
 * Legacy analyze function
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
                'version' => '2.1',
                'jiraConfigured' => defined('JIRA_EMAIL') && !empty(JIRA_EMAIL),
                'claudeConfigured' => defined('CLAUDE_API_KEY') && !empty(CLAUDE_API_KEY),
                'emailConfigured' => defined('SMTP_EMAIL') && !empty(SMTP_EMAIL)
            ]);
            break;
            
        case 'config':
            echo json_encode([
                'jiraHost' => JIRA_HOST,
                'projectKey' => JIRA_PROJECT_KEY,
                'aiEnabled' => defined('CLAUDE_API_KEY') && !empty(CLAUDE_API_KEY),
                'emailEnabled' => defined('SMTP_EMAIL') && !empty(SMTP_EMAIL)
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
            
        case 'send-email':
            $input = json_decode(file_get_contents('php://input'), true);
            $emailType = $input['emailType'] ?? 'standup';
            $recipients = $input['recipients'] ?? [];
            $sprintData = $input['sprintData'] ?? [];
            $customMessage = $input['customMessage'] ?? '';
            
            if (empty($recipients)) {
                echo json_encode(['error' => 'No recipients specified']);
                break;
            }
            
            $subjects = [
                'standup' => '📅 Daily Standup Summary - ' . date('M j, Y'),
                'health' => '📊 Sprint Health Report - ' . ($sprintData['sprint']['name'] ?? 'Current Sprint'),
                'custom' => '🤖 Message from Scrum Master Agent'
            ];
            
            $subject = $subjects[$emailType] ?? $subjects['custom'];
            
            if ($emailType === 'custom') {
                $htmlBody = generateEmailTemplate('custom', ['message' => $customMessage]);
            } else {
                $htmlBody = generateEmailTemplate($emailType, $sprintData);
            }
            
            $results = [];
            foreach ($recipients as $recipient) {
                $result = sendEmail($recipient, $subject, $htmlBody);
                $results[] = ['email' => $recipient, 'result' => $result];
            }
            
            echo json_encode(['results' => $results]);
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
