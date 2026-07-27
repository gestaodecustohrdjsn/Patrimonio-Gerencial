const config = window.APP_CONFIG ?? {};

export function hasSupabaseConfig() {
  return Boolean(config.SUPABASE_URL?.trim() && config.SUPABASE_ANON_KEY?.trim());
}

export const supabase = hasSupabaseConfig()
  ? window.supabase.createClient(config.SUPABASE_URL.trim(), config.SUPABASE_ANON_KEY.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
