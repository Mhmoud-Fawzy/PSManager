<?php
/**
 * Sessions API  — /api/sessions
 *
 * POST /api/sessions?action=start     — start session
 * POST /api/sessions?action=pause     — pause active session
 * POST /api/sessions?action=resume    — resume paused session
 * POST /api/sessions?action=extend    — add minutes
 * POST /api/sessions?action=stop      — end session, calc cost
 * POST /api/sessions?action=transfer  — move session to another device
 * POST /api/sessions?action=end_alert — mark time-up alert as played
 * GET  /api/sessions?action=history   — last 50 ended sessions
 */

declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$db     = Database::getInstance();
$action = sanitizeStr($_GET['action'] ?? '');

/* ══════════════════════════════════
   Helper: get active session for device
══════════════════════════════════ */
function getActiveSession(PDO $db, int $deviceId): ?array
{
    $stmt = $db->prepare('
        SELECT * FROM sessions
        WHERE device_id = ? AND status IN (\'running\',\'paused\')
        LIMIT 1
    ');
    $stmt->execute([$deviceId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function getSession(PDO $db, int $sessionId): ?array
{
    $stmt = $db->prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1');
    $stmt->execute([$sessionId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function calcCostPhp(int $elapsedMs, float $pricePerHour): float
{
    $hours = max(0, $elapsedMs) / 3_600_000;
    return round($hours * $pricePerHour, 2);
}

/* ══════════════════════════════════
   GET History
══════════════════════════════════ */
if ($method === 'GET' && $action === 'history') {
    $stmt = $db->query('
        SELECT
            s.id, d.name AS device_name, d.type AS device_type,
            s.start_time, s.end_time,
            s.total_cost, s.multi_minutes, s.multi_price_ph,
            s.extra_ms, s.is_fixed, s.fixed_duration
        FROM sessions s
        JOIN devices d ON d.id = s.device_id
        WHERE s.status = \'ended\'
        ORDER BY s.end_time DESC
        LIMIT 100
    ');
    respond($stmt->fetchAll());
}

/* ══════════════════════════════════
   GET Stats (dashboard summary)
══════════════════════════════════ */
if ($method === 'GET' && $action === 'stats') {
    $today = date('Y-m-d');

    $todayRevenue = $db->prepare('
        SELECT COALESCE(SUM(total_cost), 0) FROM sessions
        WHERE status=\'ended\' AND DATE(FROM_UNIXTIME(end_time/1000)) = ?
    ');
    $todayRevenue->execute([$today]);

    $totalDevices   = $db->query('SELECT COUNT(*) FROM devices')->fetchColumn();
    $activeNow      = $db->query('SELECT COUNT(*) FROM sessions WHERE status IN (\'running\',\'paused\')')->fetchColumn();
    $totalSessions  = $db->query('SELECT COUNT(*) FROM sessions WHERE status=\'ended\'')->fetchColumn();

    respond([
        'todayRevenue' => (float)$todayRevenue->fetchColumn(),
        'totalDevices' => (int)$totalDevices,
        'activeNow'    => (int)$activeNow,
        'totalSessions'=> (int)$totalSessions,
    ]);
}

/* ══════════════════════════════════
   POST Actions (body required)
══════════════════════════════════ */
if ($method !== 'POST') fail('طريقة الطلب غير مدعومة.', 405);

$body = getBody();

/* ── START ────────────────────────────────── */
if ($action === 'start') {
    $deviceId     = sanitizeInt($body['deviceId'] ?? 0, 1);
    $isFixed      = !empty($body['isFixed']);
    $fixedMinutes = sanitizeInt($body['fixedMinutes'] ?? 0);
    $nowMs        = (int)(microtime(true) * 1000);

    if ($deviceId === 0) fail('معرف الجهاز مطلوب.');

    // Verify device exists
    $devStmt = $db->prepare('SELECT id, name, price_ph FROM devices WHERE id=? LIMIT 1');
    $devStmt->execute([$deviceId]);
    $device = $devStmt->fetch();
    if (!$device) fail('الجهاز غير موجود.', 404);

    // Check no active session
    if (getActiveSession($db, $deviceId)) fail('يوجد جلسة نشطة بالفعل على هذا الجهاز.', 409);

    if ($isFixed && $fixedMinutes < 1) fail('مدة الجلسة الثابتة يجب أن تكون دقيقة على الأقل.');

    $db->beginTransaction();
    try {
        $stmt = $db->prepare('
            INSERT INTO sessions (device_id, start_time, is_fixed, fixed_duration, status)
            VALUES (?, ?, ?, ?, \'running\')
        ');
        $stmt->execute([$deviceId, $nowMs, $isFixed ? 1 : 0, $isFixed ? $fixedMinutes : 0]);
        $sessionId = (int)$db->lastInsertId();

        // Create first segment
        $segStmt = $db->prepare('
            INSERT INTO session_segments (session_id, device_id, device_name, start_time)
            VALUES (?, ?, ?, ?)
        ');
        $segStmt->execute([$sessionId, $deviceId, $device['name'], $nowMs]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        fail('فشل بدء الجلسة.', 500);
    }

    respond(['sessionId' => $sessionId, 'startTime' => $nowMs], 201);
}

/* ── PAUSE ────────────────────────────────── */
if ($action === 'pause') {
    $deviceId = sanitizeInt($body['deviceId'] ?? 0, 1);
    $nowMs    = (int)(microtime(true) * 1000);

    $session = getActiveSession($db, $deviceId);
    if (!$session || $session['status'] !== 'running') fail('لا توجد جلسة نشطة للإيقاف المؤقت.');

    $elapsed = ($nowMs - (int)$session['start_time']) + (int)$session['extra_ms'];

    $stmt = $db->prepare('
        UPDATE sessions SET paused=1, paused_time_ms=?, status=\'paused\' WHERE id=?
    ');
    $stmt->execute([$elapsed, $session['id']]);

    respond(['paused' => true, 'pausedTimeMs' => $elapsed]);
}

/* ── RESUME ───────────────────────────────── */
if ($action === 'resume') {
    $deviceId = sanitizeInt($body['deviceId'] ?? 0, 1);
    $nowMs    = (int)(microtime(true) * 1000);

    $session = getActiveSession($db, $deviceId);
    if (!$session || $session['status'] !== 'paused') fail('الجلسة ليست في وضع الإيقاف المؤقت.');

    // Recalculate: new startTime = now - pausedTimeMs
    $newStartTime = $nowMs - (int)$session['paused_time_ms'];

    $stmt = $db->prepare('
        UPDATE sessions
        SET paused=0, paused_time_ms=0, start_time=?, extra_ms=0, status=\'running\'
        WHERE id=?
    ');
    $stmt->execute([$newStartTime, $session['id']]);

    respond(['resumed' => true, 'newStartTime' => $newStartTime]);
}

/* ── EXTEND ───────────────────────────────── */
if ($action === 'extend') {
    $deviceId = sanitizeInt($body['deviceId'] ?? 0, 1);
    $minutes  = sanitizeInt($body['minutes'] ?? 0, 1);

    if ($minutes < 1 || $minutes > 480) fail('المدة المضافة يجب أن تكون بين 1 و 480 دقيقة.');

    $session = getActiveSession($db, $deviceId);
    if (!$session) fail('لا توجد جلسة نشطة.');

    $addedMs       = $minutes * 60 * 1000;
    $newFixedDur   = (int)$session['fixed_duration'] + $minutes;
    $newExtraMs    = (int)$session['extra_ms'] + $addedMs;

    $stmt = $db->prepare('
        UPDATE sessions
        SET extra_ms=?, fixed_duration=?, end_alert_played=0
        WHERE id=?
    ');
    $stmt->execute([$newExtraMs, $newFixedDur, $session['id']]);

    respond(['extendedMs' => $addedMs, 'totalExtraMs' => $newExtraMs]);
}

/* ── END ALERT (mark alert as played) ─────── */
if ($action === 'end_alert') {
    $deviceId = sanitizeInt($body['deviceId'] ?? 0, 1);
    $session  = getActiveSession($db, $deviceId);
    if (!$session) fail('لا توجد جلسة نشطة.');

    $db->prepare('UPDATE sessions SET end_alert_played=1 WHERE id=?')
       ->execute([$session['id']]);

    respond(['updated' => true]);
}

/* ── STOP ─────────────────────────────────── */
if ($action === 'stop') {
    $deviceId      = sanitizeInt($body['deviceId'] ?? 0, 1);
    $multiMinutes  = sanitizeInt($body['multiMinutes'] ?? 0);
    $multiPricePh  = sanitizeFloat($body['multiPricePh'] ?? 0);
    $nowMs         = (int)(microtime(true) * 1000);

    $session = getActiveSession($db, $deviceId);
    if (!$session) fail('لا توجد جلسة نشطة.');

    $devStmt = $db->prepare('SELECT name, price_ph FROM devices WHERE id=? LIMIT 1');
    $devStmt->execute([$deviceId]);
    $device = $devStmt->fetch();

    // Calculate elapsed
    if ($session['paused']) {
        $elapsedMs = (int)$session['paused_time_ms'];
    } else {
        $elapsedMs = ($nowMs - (int)$session['start_time']) + (int)$session['extra_ms'];
    }

    $totalMinutes  = floor($elapsedMs / 60000);
    $multiMinutes  = min($multiMinutes, (int)$totalMinutes);
    $normalMinutes = $totalMinutes - $multiMinutes;

    $normalCost = ($normalMinutes / 60) * (float)$device['price_ph'];
    $multiCost  = $multiMinutes > 0 ? ($multiMinutes / 60) * $multiPricePh : 0;
    $totalCost  = round($normalCost + $multiCost, 2);

    $db->beginTransaction();
    try {
        // End the last segment
        $segStmt = $db->prepare('
            UPDATE session_segments SET end_time=?
            WHERE session_id=? AND end_time IS NULL
        ');
        $segStmt->execute([$nowMs, $session['id']]);

        // Mark session ended
        $endStmt = $db->prepare('
            UPDATE sessions
            SET status=\'ended\', end_time=?, total_cost=?,
                multi_minutes=?, multi_price_ph=?, paused=0
            WHERE id=?
        ');
        $endStmt->execute([$nowMs, $totalCost, $multiMinutes, $multiPricePh, $session['id']]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        fail('فشل إنهاء الجلسة.', 500);
    }

    // Load segments for result modal
    $segLoadStmt = $db->prepare('
        SELECT device_name, start_time, end_time
        FROM session_segments WHERE session_id=? ORDER BY id ASC
    ');
    $segLoadStmt->execute([$session['id']]);
    $segments = $segLoadStmt->fetchAll();

    respond([
        'startTime'       => (int)$session['start_time'],
        'endTime'         => $nowMs,
        'elapsedMs'       => $elapsedMs,
        'extraMs'         => (int)$session['extra_ms'],
        'totalCost'       => $totalCost,
        'normalMinutes'   => $normalMinutes,
        'multiMinutes'    => $multiMinutes,
        'multiPricePh'    => $multiPricePh,
        'multiCost'       => round($multiCost, 2),
        'normalCost'      => round($normalCost, 2),
        'deviceName'      => $device['name'],
        'segments'        => $segments,
    ]);
}

/* ── TRANSFER ─────────────────────────────── */
if ($action === 'transfer') {
    $fromDeviceId = sanitizeInt($body['fromDeviceId'] ?? 0, 1);
    $toDeviceId   = sanitizeInt($body['toDeviceId'] ?? 0, 1);
    $nowMs        = (int)(microtime(true) * 1000);

    if ($fromDeviceId === 0 || $toDeviceId === 0) fail('معرفات الأجهزة مطلوبة.');
    if ($fromDeviceId === $toDeviceId) fail('لا يمكن النقل إلى نفس الجهاز.');

    $session = getActiveSession($db, $fromDeviceId);
    if (!$session) fail('لا توجد جلسة نشطة على الجهاز المصدر.');

    // Target must be free
    if (getActiveSession($db, $toDeviceId)) fail('الجهاز الهدف يمتلك جلسة نشطة بالفعل.', 409);

    $toDevStmt = $db->prepare('SELECT name FROM devices WHERE id=? LIMIT 1');
    $toDevStmt->execute([$toDeviceId]);
    $toDev = $toDevStmt->fetch();
    if (!$toDev) fail('الجهاز الهدف غير موجود.', 404);

    // Preserve elapsed time
    if ($session['paused']) {
        $elapsedMs = (int)$session['paused_time_ms'];
    } else {
        $elapsedMs = ($nowMs - (int)$session['start_time']) + (int)$session['extra_ms'];
    }

    $db->beginTransaction();
    try {
        // Close current segment
        $db->prepare('UPDATE session_segments SET end_time=? WHERE session_id=? AND end_time IS NULL')
           ->execute([$nowMs, $session['id']]);

        // Move session to new device, reset timer anchoring
        $newStartTime = $nowMs - $elapsedMs;
        $db->prepare('
            UPDATE sessions
            SET device_id=?, start_time=?, extra_ms=0, paused=0, paused_time_ms=0, status=\'running\'
            WHERE id=?
        ')->execute([$toDeviceId, $newStartTime, $session['id']]);

        // Open new segment
        $db->prepare('
            INSERT INTO session_segments (session_id, device_id, device_name, start_time)
            VALUES (?, ?, ?, ?)
        ')->execute([$session['id'], $toDeviceId, $toDev['name'], $nowMs]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        fail('فشل نقل الجلسة.', 500);
    }

    respond([
        'sessionId'    => (int)$session['id'],
        'toDeviceId'   => $toDeviceId,
        'toDeviceName' => $toDev['name'],
        'elapsedMs'    => $elapsedMs,
        'newStartTime' => $newStartTime,
    ]);
}

fail('إجراء غير معروف.', 400);
