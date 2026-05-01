<?php
/**
 * Shared API bootstrap — included by every API endpoint.
 * Sets JSON headers, starts session, loads DB and helpers.
 */

declare(strict_types=1);

// Only allow JSON requests from same origin
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Start PHP session (used for auth)
if (session_status() === PHP_SESSION_NONE) {
    session_name('ps_mgr_sess');
    session_start();
}

require_once __DIR__ . '/../config/database.php';

/* ─── Response helpers ──────────────────────────────── */
function respond(mixed $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ─── Auth guard ────────────────────────────────────── */
function requireAuth(): void
{
    if (empty($_SESSION['owner_id'])) {
        fail('Unauthorized. Please log in.', 401);
    }
}

/* ─── Input helpers ─────────────────────────────────── */
function getBody(): array
{
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function sanitizeStr(mixed $val, int $maxLen = 255): string
{
    return mb_substr(trim((string)($val ?? '')), 0, $maxLen);
}

function sanitizeFloat(mixed $val): float
{
    return max(0.0, (float)($val ?? 0));
}

function sanitizeInt(mixed $val, int $min = 0): int
{
    return max($min, (int)($val ?? 0));
}

/* ─── Route matching ────────────────────────────────── */
$method     = $_SERVER['REQUEST_METHOD'];
$pathInfo   = trim($_SERVER['PATH_INFO'] ?? '', '/');
$pathParts  = $pathInfo !== '' ? explode('/', $pathInfo) : [];
