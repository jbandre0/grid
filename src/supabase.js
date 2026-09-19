// Supabase client. The URL and publishable key are PUBLIC by design — they ship
// in every browser bundle. What actually protects the data is Row Level
// Security on the tables (see docs/supabase/schema.sql), not secrecy of this key.
// NEVER put the service_role / secret key or the database password in this repo.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://wdhgbazqgchmjkvjdfnw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QGtqu4jWh77cnTKwYmsmAA_h2aEstZN";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "grid.auth" },
});
