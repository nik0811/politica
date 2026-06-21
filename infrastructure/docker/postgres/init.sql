-- Initialize database with required extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial topics
INSERT INTO topics (id, name, description, document_count, created_at)
VALUES 
    (uuid_generate_v4(), 'Education', 'Educational policies and initiatives', 0, NOW()),
    (uuid_generate_v4(), 'Healthcare', 'Healthcare policies and medical services', 0, NOW()),
    (uuid_generate_v4(), 'Infrastructure', 'Roads, bridges, public works', 0, NOW()),
    (uuid_generate_v4(), 'Employment', 'Job creation and employment policies', 0, NOW()),
    (uuid_generate_v4(), 'Agriculture', 'Farming and rural development', 0, NOW()),
    (uuid_generate_v4(), 'Tourism', 'Tourism development and promotion', 0, NOW())
ON CONFLICT DO NOTHING;
