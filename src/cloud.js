// Real Supabase adapter for the sync engine (see docs/supabase/schema.sql).
// Every call is scoped by Row Level Security to the signed-in user's own row.
import { supabase } from "./supabase.js";

export const cloud = {
  // → { data, revision, updated_at } | null
  async pull(userId) {
    const { data, error } = await supabase.from("grid_store").select("data,revision,updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  },
  // → { revision } | { conflict: true } when a row already exists
  async insert(userId, data) {
    const { data: row, error } = await supabase.from("grid_store").insert({ user_id: userId, data }).select("revision").single();
    if (error) { if (error.code === "23505") return { conflict: true }; throw error; }
    return row;
  },
  // Only lands if the cloud revision is still `baseRevision` → { revision } | { conflict: true }
  async update(userId, data, baseRevision) {
    const { data: rows, error } = await supabase.from("grid_store").update({ data })
      .eq("user_id", userId).eq("revision", baseRevision).select("revision");
    if (error) throw error;
    return rows && rows.length ? rows[0] : { conflict: true };
  },
};
