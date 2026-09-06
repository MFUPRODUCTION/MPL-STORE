// Publik di browser. Hanya anon/publishable key, JANGAN secret/service_role.
globalThis.SantriPulangConfig = Object.freeze({
  useSupabase: false,
  supabase: {
    url: 'https://YOUR_PROJECT.supabase.co',
    anonKey: 'YOUR_ANON_OR_PUBLISHABLE_KEY'
  }
});
