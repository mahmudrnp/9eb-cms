import { supabase } from './supabaseClient';
import type { AuditLogRow, ExportFormat, LoginEventRow, LoginEventType } from '../types/database.types';

const PAGE_SIZE = 100;

export interface AuditLogFilters {
  tableName?: string;
  action?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  offset?: number;
}

// canteen_admin-এর জন্য — RLS-এ আগে থেকেই সীমিত (phase14_audit_security.sql), তাই
// এখানে আলাদা রোল-চেক লাগে না, তবে ProtectedRoute-এ রুট-লেভেলেও গার্ড করা আছে (UX)।
export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogRow[]> {
  let q = supabase
    .from('audit_logs')
    .select('id, user_id, action, table_name, record_id, before_value, after_value, created_at, profiles(name)')
    .order('created_at', { ascending: false });

  if (filters.tableName) q = q.eq('table_name', filters.tableName);
  if (filters.action) q = q.eq('action', filters.action);
  if (filters.startDate) q = q.gte('created_at', `${filters.startDate}T00:00:00`);
  if (filters.endDate) q = q.lte('created_at', `${filters.endDate}T23:59:59`);

  const offset = filters.offset ?? 0;
  const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as unknown as AuditLogRow[];
}

export async function fetchDistinctAuditTables(): Promise<string[]> {
  const { data, error } = await supabase.from('audit_logs').select('table_name').limit(1000);
  if (error) throw error;
  const set = new Set((data ?? []).map((r: { table_name: string }) => r.table_name));
  return Array.from(set).sort();
}

export interface LoginEventFilters {
  eventType?: LoginEventType;
  startDate?: string;
  endDate?: string;
  offset?: number;
}

export async function fetchLoginEvents(filters: LoginEventFilters = {}): Promise<LoginEventRow[]> {
  let q = supabase
    .from('login_events')
    .select('id, user_id, email_attempted, event_type, user_agent, created_at, profiles(name)')
    .order('created_at', { ascending: false });

  if (filters.eventType) q = q.eq('event_type', filters.eventType);
  if (filters.startDate) q = q.gte('created_at', `${filters.startDate}T00:00:00`);
  if (filters.endDate) q = q.lte('created_at', `${filters.endDate}T23:59:59`);

  const offset = filters.offset ?? 0;
  const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as unknown as LoginEventRow[];
}

// ============ লেখার দিক (write side) ============

// AuthContext থেকে কল হয় — লগইন-সফল/লগআউট/ব্যর্থ-চেষ্টা প্রতিটাই একটা নতুন
// row (কখনো ওভাররাইট না, Phase01-এর সাধারণ লেজার-নীতির সাথে সামঞ্জস্যপূর্ণ)।
// ব্যর্থ হলেও silently সরে যায় — নিরাপত্তা-লগিং কখনো মূল ইউজার-ফ্লো ব্লক করবে না।
export async function logLoginEvent(params: {
  eventType: LoginEventType;
  userId?: string | null;
  emailAttempted?: string | null;
}): Promise<void> {
  try {
    await supabase.from('login_events').insert({
      event_type: params.eventType,
      user_id: params.userId ?? null,
      email_attempted: params.emailAttempted ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    // নিরাপত্তা-লগিং ব্যর্থ হলে মূল অথ-ফ্লো কখনো আটকাবে না
  }
}

// ExportBar থেকে কল হয় — কোনো নতুন টেবিল লাগে না, বিদ্যমান audit_logs-এই
// action='export' হিসেবে ইনসার্ট হয় (Phase02-এর audit_system_insert পলিসি
// আগে থেকেই যেকোনো authenticated ইউজারের ইনসার্ট অনুমতি দেয়)।
export async function logExportEvent(params: {
  reportName: string;
  format: ExportFormat;
  rowCount: number;
}): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      action: 'export',
      table_name: params.reportName,
      after_value: { format: params.format, row_count: params.rowCount },
    });
  } catch {
    // এক্সপোর্ট-লগ ব্যর্থ হলেও ব্যবহারকারীর ডাউনলোড আটকানো উচিত না
  }
}
