-- Criar tabela bot_configs se não existir
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  is_powered_on BOOLEAN DEFAULT false,
  is_running BOOLEAN DEFAULT false,
  test_mode BOOLEAN DEFAULT true,
  test_balance NUMERIC DEFAULT 1000,
  quantity NUMERIC DEFAULT 100,
  take_profit_percent NUMERIC DEFAULT 5.0,
  stop_loss_percent NUMERIC DEFAULT 2.5,
  daily_profit_goal NUMERIC DEFAULT 50,
  trading_pair TEXT DEFAULT 'BTCUSDT',
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  reset_circuit_breaker BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);

-- Inserir configuração inicial para Paper Trading
INSERT INTO bot_configs (
  user_id,
  is_powered_on,
  is_running,
  test_mode,
  test_balance,
  quantity,
  take_profit_percent,
  stop_loss_percent,
  daily_profit_goal,
  trading_pair
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  false, -- Bot começa desligado
  false,
  true, -- MODO TESTE - Paper Trading
  1000, -- $1000 virtual
  100,
  5.0,
  2.5,
  50,
  'BTCUSDT'
)
ON CONFLICT DO NOTHING;
