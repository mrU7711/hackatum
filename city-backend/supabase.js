const { createClient } = require("@supabase/supabase-js");

// Replace these with your actual Supabase credentials
const supabaseUrl = "https://dbejkqpadeuagxauunfv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZWprcXBhZGV1YWd4YXV1bmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjM4ODUsImV4cCI6MjA3OTMzOTg4NX0.CDQnlyAgs3fJ0vkr1f01ymHONF-7Khg5Sj2qAnnHi3k"; // Get this from Supabase dashboard -> Settings -> API

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;