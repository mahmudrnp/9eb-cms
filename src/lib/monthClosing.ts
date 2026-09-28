import { supabase } from './supabaseClient';
import type { MonthlyClosingPreview, MonthlyClosing } from '../types/database.types';

// Phase02/11 নীতি: কোনো স্টোরড-সামারি-ফিল্ড না — প্রিভিউ সবসময় লাইভ-ট্রানজেকশন থেকে গণনা করা
export async function fetchClosingPreview(startDate: string, endDate: string): Promise<MonthlyClosingPreview> {
  const { data, error } = await supabase.rpc('monthly_closing_preview', { p_start: startDate, p_end: endDate });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as MonthlyClosingPreview;
}

export interface FinalizeClosingInput {
  closingMonth: string; // মাসের ১ তারিখ (YYYY-MM-01)
  startDate: string;
  endDate: string;
  physicalStock: number;
}

// অপরিবর্তনীয় — একবার ফাইনালাইজ হলে আর করা যাবে না (RPC নিজেই এটা নিশ্চিত করে)
export async function finalizeMonthClosing(input: FinalizeClosingInput): Promise<string> {
  const { data, error } = await supabase.rpc('finalize_month_closing', {
    p_closing_month: input.closingMonth,
    p_start: input.startDate,
    p_end: input.endDate,
    p_physical_stock: input.physicalStock,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchClosingHistory(): Promise<MonthlyClosing[]> {
  const { data, error } = await supabase
    .from('monthly_closings')
    .select('*')
    .order('closing_month', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
