import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

// Universal environment variable access (Vite or Node.js)
const getEnvVar = (key: string): string => {
    // Browser/Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env[key] || '';
    }
    // Node.js environment
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || '';
    }
    return '';
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
const SUPABASE_PUBLISHABLE_KEY = getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');
const SUPABASE_SERVICE_ROLE_KEY = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

// Use Service Role Key if available (admin mode), otherwise use Publishable Key
const FINAL_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY;

// DEBUG: Log what we're getting
console.log('🔧 Supabase Config:', { 
    hasUrl: !!SUPABASE_URL, 
    hasKey: !!FINAL_KEY,
    url: SUPABASE_URL ? 'definida' : 'undefined'
});

// Safe initialization - show warning if missing
const safeSupabaseUrl = SUPABASE_URL || "https://placeholder.supabase.co";
const safeSupabaseKey = FINAL_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldHFibXVqamNuYXhrcHljaGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcyNzM5OCwiZXhwIjoyMDg2MzAzMzk4fQ.Lx0ZfC9XMWdSw6Rmc_RAq8eHw_ULRKEjg-I5Fp-Zhso";

export const supabase = createClient<Database>(safeSupabaseUrl, safeSupabaseKey);
