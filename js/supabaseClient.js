// js/supabaseClient.js

// Your Supabase project details
const SUPABASE_URL = "https://jrduxqxkcpvelfyqauoa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RucRoxxq4irUKtxjnLHFnw_djJxJC28";

// Supabase JS client from CDN is available as window.supabase
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Expose to other files if needed later
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.supabaseClient = supabaseClient;
