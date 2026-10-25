/**
 * Activity and Audit Event Interfaces for DepShield
 */

export type ActivityActionType =
  | 'parsing'
  | 'osv_check'
  | 'search'
  | 'fetch'
  | 'evidence_analysis'
  | 'scoring'
  | 'findings'
  | 'system';

export interface ActivityEvent {
  id: string;
  actionType: ActivityActionType;
  title: string;
  description: string;
  timestamp: string;
  targetPackage?: string;
  status: 'success' | 'warning' | 'info' | 'flagged';
  isSimulated: boolean;
  metadata?: Record<string, string | number | boolean>;
}
