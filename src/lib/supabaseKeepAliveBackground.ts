import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { isSupabaseConfigured } from './supabase';
import { isSupabaseBackend } from './backendMode';

const SUPABASE_KEEPALIVE_TASK = 'SUPABASE_DAILY_KEEPALIVE_TASK';
const LAST_RUN_KEY = 'supabase_keepalive_last_run_at';
const DAY_MS = 24 * 60 * 60 * 1000;

async function runDailySupabaseKeepAlive(): Promise<boolean> {
  if (!(await isSupabaseBackend())) return false;
  if (!isSupabaseConfigured()) return false;
  const { syncFromSupabase, syncToSupabase } = await import('./supabaseMobileSync');
  const now = Date.now();
  const lastRaw = await AsyncStorage.getItem(LAST_RUN_KEY);
  const last = lastRaw ? Number(lastRaw) : 0;
  if (Number.isFinite(last) && last > 0 && now - last < DAY_MS * 0.9) {
    return false;
  }
  const push = await syncToSupabase();
  const pull = await syncFromSupabase();
  if (!push.ok && !pull.ok) {
    return false;
  }
  await AsyncStorage.setItem(LAST_RUN_KEY, String(now));
  return true;
}

if (!TaskManager.isTaskDefined(SUPABASE_KEEPALIVE_TASK)) {
  TaskManager.defineTask(SUPABASE_KEEPALIVE_TASK, async () => {
    try {
      const ok = await runDailySupabaseKeepAlive();
      return ok ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerSupabaseDailyKeepAliveTask(): Promise<void> {
  if (!(await isSupabaseBackend())) return;
  if (!isSupabaseConfigured()) return;
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Denied ||
    status === BackgroundFetch.BackgroundFetchStatus.Restricted
  ) {
    return;
  }
  const already = await TaskManager.isTaskRegisteredAsync(SUPABASE_KEEPALIVE_TASK);
  if (already) return;
  await BackgroundFetch.registerTaskAsync(SUPABASE_KEEPALIVE_TASK, {
    minimumInterval: DAY_MS,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function unregisterSupabaseDailyKeepAliveTask(): Promise<void> {
  const already = await TaskManager.isTaskRegisteredAsync(SUPABASE_KEEPALIVE_TASK);
  if (!already) return;
  await BackgroundFetch.unregisterTaskAsync(SUPABASE_KEEPALIVE_TASK);
}
