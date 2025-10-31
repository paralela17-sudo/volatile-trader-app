-- Fix ON CONFLICT error in rate_limit_tracking table
-- Create a unique constraint on user_id and endpoint to support the ON CONFLICT clause

-- Drop the existing primary key if needed and create a composite unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_user_endpoint 
ON public.rate_limit_tracking(user_id, endpoint);

-- Add a comment explaining the index
COMMENT ON INDEX public.idx_rate_limit_user_endpoint IS 
'Unique index to support ON CONFLICT in check_rate_limit function';