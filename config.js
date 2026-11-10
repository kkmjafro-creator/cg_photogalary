/* ------------------------------------------------------------------
   AR Gallery configuration – edit the two Supabase values below.
   The anon key is PUBLIC by design (safe in browser code) because
   Row Level Security protects the data. NEVER put the service_role
   key in this file. Browser-side login credentials are not secure.
------------------------------------------------------------------- */
window.ARG_CONFIG = {
  SUPABASE_URL: "https://zchbxprgfxmvlngehwgl.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaGJ4cHJnZnhtdmxuZ2Vod2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTQyNTMsImV4cCI6MjEwOTQ3MDI1M30.m7VTUVyV575E3P4ub978Y76egHk77h6A4XEqi4PgqSo",

  BUCKET: "career-fair-ar",
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  SIGNED_URL_SECONDS: 3600,

  // Link back to your existing Career Fair website (home page).
  HOME_URL: "../index.html",

  // Optional: background image URL per class card (leave "" for gold gradient).
  CLASS_BACKGROUNDS: { "class-9": "", "class-10": "", "class-11": "", "class-12": "" }
};
