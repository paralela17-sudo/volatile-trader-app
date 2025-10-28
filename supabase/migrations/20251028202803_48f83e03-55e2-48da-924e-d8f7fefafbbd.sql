-- Create function to clean up old bot logs (90 days retention)
-- This function can be called by a scheduled job or manually
CREATE OR REPLACE FUNCTION public.cleanup_old_bot_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete logs older than 90 days
  DELETE FROM public.bot_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.cleanup_old_bot_logs() IS 'Deletes bot logs older than 90 days. Should be called periodically by a scheduled job.';