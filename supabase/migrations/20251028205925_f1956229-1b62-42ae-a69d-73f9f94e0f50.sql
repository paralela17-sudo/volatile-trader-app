-- Create rate limiting tracking table
CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (edge functions will use service role)
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limit_tracking
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient lookups
CREATE INDEX idx_rate_limit_user_endpoint ON public.rate_limit_tracking(user_id, endpoint, window_start);

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_request_count INTEGER;
BEGIN
  -- Calculate window start time
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Get current request count in window
  SELECT COALESCE(SUM(request_count), 0)
  INTO v_request_count
  FROM public.rate_limit_tracking
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start > v_window_start;
  
  -- Check if under limit
  IF v_request_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Record this request
  INSERT INTO public.rate_limit_tracking (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, NOW())
  ON CONFLICT (user_id, endpoint) 
  WHERE window_start > v_window_start
  DO UPDATE SET 
    request_count = public.rate_limit_tracking.request_count + 1,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limit_tracking
  WHERE created_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Add trigger to update updated_at on rate_limit_tracking
CREATE TRIGGER update_rate_limit_tracking_updated_at
BEFORE UPDATE ON public.rate_limit_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();