import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
// NEXT_PUBLIC_SUPABASE_URL=
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Vbno_W45itCahi9Jk51hzA_dc-0A6QM
export const supabase = createClient(supabaseUrl, supabaseKey);