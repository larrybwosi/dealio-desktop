/**
 * Enterprise Logger Utility
 *
 * Wraps @tauri-apps/plugin-log to provide a consistent, structured logging
 * API across the frontend. All logs are persisted to the backend log file.
 */
import {
  debug as tauriDebug,
  info as tauriInfo,
  warn as tauriWarn,
  error as tauriError,
} from "@tauri-apps/plugin-log";
import { invoke } from "@tauri-apps/api/core";

// ============================================================
// Public Logger API
// ============================================================

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    const formatted = context
      ? `${message} | ${JSON.stringify(context)}`
      : message;
    tauriDebug(formatted).catch(() => {});
  },

  info: (message: string, context?: Record<string, unknown>) => {
    const formatted = context
      ? `${message} | ${JSON.stringify(context)}`
      : message;
    tauriInfo(formatted).catch(() => {});
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    const formatted = context
      ? `${message} | ${JSON.stringify(context)}`
      : message;
    tauriWarn(formatted).catch(() => {});
  },

  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    const errStr =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error ?? "");
    const formatted = context
      ? `${message} | error: ${errStr} | ${JSON.stringify(context)}`
      : `${message} | error: ${errStr}`;
    tauriError(formatted).catch(() => {});
  },
};

// ============================================================
// Audit Trail
// ============================================================

export interface AuditOptions {
  action: string;
  level?: "INFO" | "WARNING" | "CRITICAL";
  actorId?: string;
  actorName?: string;
  locationId?: string;
  details?: Record<string, unknown>;
}

/**
 * Write a structured audit event to the backend audit trail.
 * This is the primary API for tracking user-initiated actions.
 */
export async function writeAudit(opts: AuditOptions): Promise<void> {
  try {
    await invoke("write_audit_log", {
      action: opts.action,
      level: opts.level ?? "INFO",
      actorId: opts.actorId ?? null,
      actorName: opts.actorName ?? null,
      locationId: opts.locationId ?? null,
      deviceId: null,
      details: opts.details ?? null,
    });
  } catch (e) {
    // Best-effort — don't break the app if audit writing fails
    logger.warn(`[Audit] Failed to write audit event: ${opts.action}`, {
      error: String(e),
    });
  }
}

// ============================================================
// Global Error Capture
// ============================================================

/**
 * Call this once on app startup to automatically log
 * unhandled promise rejections and window errors to file.
 */
export function setupGlobalErrorCapture(): void {
  window.addEventListener("unhandledrejection", (event) => {
    logger.error("[Unhandled Promise Rejection]", event.reason);
  });

  window.addEventListener("error", (event) => {
    logger.error("[Uncaught Error]", event.error ?? event.message);
  });
}
