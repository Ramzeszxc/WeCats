// supabase.js
// Supabase client setup for WeCats

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://adcsdulxwkktbcwlfmhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkY3NkdWx4d2trdGJjd2xmbWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2NzYzNDgsImV4cCI6MjA2MjI1MjM0OH0.cY9pwPWtT7A4SKyM9P5cqx8Qo51aTQa5B5z2kNB4veM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 