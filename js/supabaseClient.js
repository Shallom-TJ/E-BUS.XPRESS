// ==========================================================================
// E-BUS CONNECT UGANDA - SUPABASE CLIENT INITIALIZATION
// Step B: Authenticated Backend Client
// ==========================================================================

const SUPABASE_URL = 'https://fttruhzerguzhwwrwnou.supabase.co';
// Public / Anon key — safe to expose in frontend code with RLS enabled
const SUPABASE_ANON_KEY = 'sb_publishable_mnloHseUrDSUoUWi0ZhVtw_vhpC_GWv';

// Initialize the Supabase client
let supabaseClient = null;

try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    console.log('[Supabase] Client initialized successfully.');
  } else {
    console.warn('[Supabase] CDN library not loaded yet; client will be initialized once available.');
  }
} catch (err) {
  console.error('[Supabase] Failed to initialize client:', err);
}

// Make accessible on window
window.supabaseClient = supabaseClient;
window.SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};
