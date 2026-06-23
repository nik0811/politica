-- Migration to ensure all enum values exist
-- This is safe to run multiple times (idempotent)

-- Create or replace the platform enum type
DO $$ BEGIN
    -- Drop existing constraints if any
    ALTER TABLE IF EXISTS documents DROP CONSTRAINT IF EXISTS documents_platform_check;
    ALTER TABLE IF EXISTS browser_sessions DROP CONSTRAINT IF EXISTS browser_sessions_platform_check;
    
    -- Check if the type exists and recreate it
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform') THEN
        DROP TYPE platform CASCADE;
    END IF;
    
    CREATE TYPE platform AS ENUM (
        'instagram',
        'twitter',
        'x',
        'telegram',
        'facebook',
        'news',
        'website'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recreate the processing status enum if needed
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processingstatus') THEN
        DROP TYPE processingstatus CASCADE;
    END IF;
    
    CREATE TYPE processingstatus AS ENUM (
        'pending',
        'processing',
        'processed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recreate tables with correct enums if they exist
-- This ensures tables use the new enum types
