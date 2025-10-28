-- Atualizar todas as configurações existentes para usar os valores fixos
UPDATE public.bot_configurations 
SET 
  stop_loss_percent = 3.00,
  take_profit_percent = 6.00;

-- Criar função para garantir que stop loss e take profit sempre sejam 3% e 6%
CREATE OR REPLACE FUNCTION public.enforce_fixed_risk_params()
RETURNS TRIGGER AS $$
BEGIN
  -- Força os valores fixos independentemente do que foi enviado
  NEW.stop_loss_percent := 3.00;
  NEW.take_profit_percent := 6.00;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para INSERT
DROP TRIGGER IF EXISTS trg_enforce_fixed_risk_params_insert ON public.bot_configurations;
CREATE TRIGGER trg_enforce_fixed_risk_params_insert
  BEFORE INSERT ON public.bot_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fixed_risk_params();

-- Criar trigger para UPDATE
DROP TRIGGER IF EXISTS trg_enforce_fixed_risk_params_update ON public.bot_configurations;
CREATE TRIGGER trg_enforce_fixed_risk_params_update
  BEFORE UPDATE ON public.bot_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fixed_risk_params();