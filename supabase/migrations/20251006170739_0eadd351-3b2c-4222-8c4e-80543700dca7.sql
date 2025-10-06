-- Create function for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create bot_configurations table to securely store user bot settings
CREATE TABLE public.bot_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  test_mode BOOLEAN DEFAULT true,
  test_balance DECIMAL(20, 8) DEFAULT 1000,
  trading_pair TEXT DEFAULT 'BTCUSDT',
  quantity DECIMAL(20, 8) DEFAULT 0.001,
  take_profit_percent DECIMAL(5, 2) DEFAULT 2.00,
  stop_loss_percent DECIMAL(5, 2) DEFAULT 1.00,
  daily_profit_goal DECIMAL(20, 8) DEFAULT 50,
  is_running BOOLEAN DEFAULT false,
  is_powered_on BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.bot_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own configurations
CREATE POLICY "Users can view their own bot config"
  ON public.bot_configurations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bot config"
  ON public.bot_configurations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bot config"
  ON public.bot_configurations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bot config"
  ON public.bot_configurations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_bot_configurations_updated_at
  BEFORE UPDATE ON public.bot_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();