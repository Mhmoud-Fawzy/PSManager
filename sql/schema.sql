-- =====================================================
-- PS Manager — Database Schema
-- =====================================================
-- Run this file once to set up the database:
--   mysql -u root -p < schema.sql
-- =====================================================

CREATE DATABASE IF NOT EXISTS ps_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ps_manager;

-- ─────────────────────────────────────────────
-- Devices
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)    NOT NULL,
  type        VARCHAR(50)    NOT NULL DEFAULT 'PlayStation',
  price_ph    DECIMAL(8,2)   NOT NULL,
  sort_order  SMALLINT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_device_name (name),
  CONSTRAINT chk_price CHECK (price_ph > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Sessions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id       INT UNSIGNED NOT NULL,
  start_time      BIGINT       NOT NULL COMMENT 'epoch ms',
  end_time        BIGINT       NULL      COMMENT 'epoch ms',
  extra_ms        BIGINT       NOT NULL DEFAULT 0,
  paused          TINYINT(1)   NOT NULL DEFAULT 0,
  paused_time_ms  BIGINT       NOT NULL DEFAULT 0,
  is_fixed        TINYINT(1)   NOT NULL DEFAULT 0,
  fixed_duration  INT          NOT NULL DEFAULT 0 COMMENT 'minutes',
  end_alert_played TINYINT(1)  NOT NULL DEFAULT 0,
  status          ENUM('running','paused','ended') NOT NULL DEFAULT 'running',
  total_cost      DECIMAL(10,2) NULL,
  multi_minutes   INT          NOT NULL DEFAULT 0,
  multi_price_ph  DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_device_id (device_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Session Segments (for device-transfer tracking)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_segments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  INT UNSIGNED NOT NULL,
  device_id   INT UNSIGNED NOT NULL,
  device_name VARCHAR(50)  NOT NULL,
  start_time  BIGINT       NOT NULL COMMENT 'epoch ms',
  end_time    BIGINT       NULL     COMMENT 'epoch ms',
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Shop Owner (single account)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_owner (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(30)  NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default owner: username=admin, password=admin123 (change immediately!)
INSERT IGNORE INTO shop_owner (username, password)
VALUES ('admin', '$2y$12$dFMAl68MdFFc8nP7qLkRVe/.RiuwcsY4ULWZjOXacifimFEG6OWAC');
-- Password hash above = bcrypt('admin123', cost=12)

-- ─────────────────────────────────────────────
-- Sample Data (optional — remove in production)
-- ─────────────────────────────────────────────
INSERT IGNORE INTO devices (name, type, price_ph, sort_order) VALUES
  ('PS5-1', 'PlayStation 5', 50.00, 1),
  ('PS5-2', 'PlayStation 5', 50.00, 2),
  ('PS4-Pro', 'PlayStation 4 Pro', 35.00, 3),
  ('PS4-1', 'PlayStation 4', 25.00, 4);
