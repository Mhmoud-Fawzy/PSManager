<?php
/**
 * Devices API  — /api/devices
 *
 * GET    /api/devices            — list all devices (with active session status)
 * POST   /api/devices            — create device
 * PUT    /api/devices?id={id}    — update device
 * DELETE /api/devices?id={id}    — delete device
 */

declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
requireAuth();

$db = Database::getInstance();

/* ══════════════════════════════════
   GET — List all devices
══════════════════════════════════ */
if ($method === 'GET') {
    $stmt = $db->query('
        SELECT
            d.id, d.name, d.type, d.price_ph, d.sort_order, d.created_at,
            s.id          AS session_id,
            s.start_time,
            s.extra_ms,
            s.paused,
            s.paused_time_ms,
            s.is_fixed,
            s.fixed_duration,
            s.end_alert_played,
            s.status      AS session_status
        FROM devices d
        LEFT JOIN sessions s
            ON s.device_id = d.id AND s.status IN (\'running\',\'paused\')
        ORDER BY d.sort_order ASC, d.id ASC
    ');
    $rows = $stmt->fetchAll();

    // Attach session segments
    $devices = [];
    foreach ($rows as $row) {
        $device = [
            'id'         => (int)$row['id'],
            'name'       => $row['name'],
            'type'       => $row['type'],
            'pricePerHour' => (float)$row['price_ph'],
            'sortOrder'  => (int)$row['sort_order'],
            'running'    => $row['session_id'] !== null,
            'session'    => null,
        ];

        if ($row['session_id'] !== null) {
            // Load segments for this session
            $segStmt = $db->prepare('
                SELECT device_name, start_time, end_time
                FROM session_segments WHERE session_id = ? ORDER BY id ASC
            ');
            $segStmt->execute([$row['session_id']]);
            $segments = $segStmt->fetchAll();

            $device['session'] = [
                'id'              => (int)$row['session_id'],
                'startTime'       => (int)$row['start_time'],
                'extraMs'         => (int)$row['extra_ms'],
                'paused'          => (bool)$row['paused'],
                'pausedTimeMs'    => (int)$row['paused_time_ms'],
                'isFixed'         => (bool)$row['is_fixed'],
                'fixedDuration'   => (int)$row['fixed_duration'],
                'endAlertPlayed'  => (bool)$row['end_alert_played'],
                'status'          => $row['session_status'],
                'sessionSegments' => array_map(function ($seg) {
                    return [
                        'deviceName' => $seg['device_name'],
                        'startTime'  => (int)$seg['start_time'],
                        'endTime'    => $seg['end_time'] !== null ? (int)$seg['end_time'] : null,
                    ];
                }, $segments),
            ];
        }

        $devices[] = $device;
    }

    respond($devices);
}

/* ══════════════════════════════════
   POST — Create device
══════════════════════════════════ */
if ($method === 'POST') {
    $body  = getBody();
    $name  = sanitizeStr($body['name'] ?? '', 50);
    $type  = sanitizeStr($body['type'] ?? 'PlayStation', 50);
    $price = sanitizeFloat($body['pricePerHour'] ?? 0);

    if ($name === '')     fail('اسم الجهاز مطلوب.');
    if ($price <= 0)      fail('السعر يجب أن يكون أكبر من صفر.');

    // Get next sort_order
    $maxOrder = $db->query('SELECT COALESCE(MAX(sort_order),0) FROM devices')->fetchColumn();

    try {
        $stmt = $db->prepare('
            INSERT INTO devices (name, type, price_ph, sort_order)
            VALUES (?, ?, ?, ?)
        ');
        $stmt->execute([$name, $type ?: 'PlayStation', $price, (int)$maxOrder + 1]);
        $id = (int)$db->lastInsertId();
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            fail("الجهاز '{$name}' موجود بالفعل.", 409);
        }
        fail('خطأ في قاعدة البيانات.', 500);
    }

    respond([
        'id'          => $id,
        'name'        => $name,
        'type'        => $type ?: 'PlayStation',
        'pricePerHour'=> $price,
        'sortOrder'   => (int)$maxOrder + 1,
        'running'     => false,
        'session'     => null,
    ], 201);
}

/* ══════════════════════════════════
   PUT — Update device
══════════════════════════════════ */
if ($method === 'PUT') {
    $id   = sanitizeInt($_GET['id'] ?? 0, 1);
    $body = getBody();

    if ($id === 0) fail('معرف الجهاز مطلوب.');

    // Block edit if session is running
    $running = $db->prepare('SELECT id FROM sessions WHERE device_id=? AND status IN (\'running\',\'paused\') LIMIT 1');
    $running->execute([$id]);
    if ($running->fetchColumn()) fail('لا يمكن تعديل جهاز يمتلك جلسة نشطة.', 409);

    $name  = sanitizeStr($body['name'] ?? '', 50);
    $type  = sanitizeStr($body['type'] ?? '', 50);
    $price = sanitizeFloat($body['pricePerHour'] ?? 0);

    if ($name === '')  fail('اسم الجهاز مطلوب.');
    if ($price <= 0)   fail('السعر يجب أن يكون أكبر من صفر.');

    try {
        $stmt = $db->prepare('UPDATE devices SET name=?, type=?, price_ph=? WHERE id=?');
        $stmt->execute([$name, $type ?: 'PlayStation', $price, $id]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') fail("الجهاز '{$name}' موجود بالفعل.", 409);
        fail('خطأ في قاعدة البيانات.', 500);
    }

    respond(['id' => $id, 'name' => $name, 'type' => $type, 'pricePerHour' => $price]);
}

/* ══════════════════════════════════
   DELETE — Remove device
══════════════════════════════════ */
if ($method === 'DELETE') {
    $id = sanitizeInt($_GET['id'] ?? 0, 1);
    if ($id === 0) fail('معرف الجهاز مطلوب.');

    // Block delete if session is running
    $running = $db->prepare('SELECT id FROM sessions WHERE device_id=? AND status IN (\'running\',\'paused\') LIMIT 1');
    $running->execute([$id]);
    if ($running->fetchColumn()) fail('لا يمكن حذف جهاز يمتلك جلسة نشطة.', 409);

    $stmt = $db->prepare('DELETE FROM devices WHERE id=?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) fail('الجهاز غير موجود.', 404);

    respond(['deleted' => $id]);
}

fail('طريقة الطلب غير مدعومة.', 405);
