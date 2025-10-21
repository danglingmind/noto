-- Backfill trial dates for existing users
-- Set trialStartDate to 30 days ago and trialEndDate to 16 days ago
-- This allows testing with expired trial scenarios

UPDATE users 
SET 
  "trialStartDate" = NOW() - INTERVAL '30 days',
  "trialEndDate" = NOW() - INTERVAL '16 days'
WHERE "trialEndDate" IS NULL;
