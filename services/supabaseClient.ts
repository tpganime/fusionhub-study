import { createClient } from '@supabase/supabase-js';

// In a real Vercel deployment, use process.env or import.meta.env
// For this specific request, we use the provided keys as default fallbacks.
const supabaseUrl = 'https://phoadnpnhrrywqaneeor.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBob2FkbnBuaHJyeXdxYW5lZW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzUzODIsImV4cCI6MjA4MDk1MTM4Mn0.oJaWf5hzRSqJd_STVXtKcRhVqU0ODU5aQQgFkWZFit4';

export const supabase = createClient(supabaseUrl, supabaseKey);