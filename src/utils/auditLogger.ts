import { AuditLog } from '../types';

export function createAuditLog(
  action: string,
  details: string,
  performedBy: string,
  performedByType: 'admin' | 'manager' | 'team',
  metadata?: Record<string, any>
): AuditLog {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    action,
    details,
    performedBy,
    performedByType,
    timestamp: Date.now(),
    metadata: metadata || {}
  };
}

export function logAction(
  auditLogs: AuditLog[],
  setAuditLogs: (logs: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => void,
  action: string,
  details: string,
  performedBy: string,
  performedByType: 'admin' | 'manager' | 'team',
  metadata?: Record<string, any>
) {
  const log = createAuditLog(action, details, performedBy, performedByType, metadata);
  setAuditLogs(prev => [log, ...prev].slice(0, 1000)); // Keep last 1000 logs
}