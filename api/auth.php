<?php
/**
 * Auth API  — /api/auth
 *
 * POST /api/auth?action=login   { username, password }
 * POST /api/auth?action=logout
 * GET  /api/auth?action=check
 */

declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

$action = sanitizeStr($_GET['action'] ?? '');

/* ── Check ── */
if ($method === 'GET' && $action === 'check') {
    respond(['authenticated' => !empty($_SESSION['owner_id'])]);
}

/* ── Login ── */
if ($method === 'POST' && $action === 'login') {
    $body     = getBody();
    $username = sanitizeStr($body['username'] ?? '', 30);
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        fail('اسم المستخدم وكلمة المرور مطلوبان.');
    }

    $db   = Database::getInstance();
    $stmt = $db->prepare('SELECT id, password FROM shop_owner WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $owner = $stmt->fetch();

    if (!$owner || !password_verify($password, $owner['password'])) {
        fail('اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
    }

    // Regenerate session ID to prevent fixation
    session_regenerate_id(true);
    $_SESSION['owner_id']   = $owner['id'];
    $_SESSION['owner_name'] = $username;

    respond(['message' => 'تم تسجيل الدخول بنجاح.', 'username' => $username]);
}

/* ── Logout ── */
if ($method === 'POST' && $action === 'logout') {
    $_SESSION = [];
    session_destroy();
    respond(['message' => 'تم تسجيل الخروج.']);
}

fail('طلب غير صالح.', 400);
