import { supabase } from './supabaseClient';
import type { Expense, ProfitLossResult } from '../types/database.types';

export async function fetchExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
  let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
  if (startDate) q = q.gte('expense_date', startDate);
  if (endDate) q = q.lte('expense_date', endDate);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return data ?? [];
}

export interface ExpenseInput {
  category: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  description: string | null;
  recordedBy: string;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      category: input.category,
      amount: input.amount,
      expense_date: input.expenseDate,
      description: input.description,
      recorded_by: input.recordedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Phase02 `profit_loss()` SQL ফাংশন — সব ডেরাইভড-ভ্যালু লাইভ-ট্রানজেকশন থেকে (কোনো স্টোরড-সামারি-ফিল্ড না)
export async function fetchProfitLoss(startDate: string, endDate: string): Promise<ProfitLossResult> {
  const { data, error } = await supabase.rpc('profit_loss', { p_start: startDate, p_end: endDate });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as ProfitLossResult;
}
