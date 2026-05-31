-- Migration: old per-user "courses" → admin catalog + student enrollments
-- Run in Supabase SQL Editor if you already ran the original schema.sql

drop table if exists public.courses cascade;

-- Then run the entire contents of schema.sql in a new query (or continue below).
