import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null

if (!supabaseConfigured) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_KEY. Add them to a .env file and restart the dev server.',
  )
}
