import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const encryptionKey = Deno.env.get('BINANCE_ENCRYPTION_KEY')!;

// Função para descriptografar (XOR simples - em produção usar crypto.subtle)
function decrypt(encrypted: string): string {
  const bytes = new Uint8Array(encrypted.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const decrypted = new Uint8Array(bytes.length);
  
  for (let i = 0; i < bytes.length; i++) {
    decrypted[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

// Gerar assinatura HMAC SHA256 para Binance
function generateSignature(queryString: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(queryString);
  return hmac.digest("hex");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verificar autenticação do usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { symbol, side, quantity, type = 'MARKET', testMode = true } = await req.json();

    console.log(`Executing ${side} trade for ${symbol}, quantity: ${quantity}, testMode: ${testMode}`);

    // Buscar configuração do bot do usuário
    const { data: config, error: configError } = await supabase
      .from('bot_configurations')
      .select('api_key_encrypted, api_secret_encrypted, test_mode')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      throw new Error('Bot configuration not found');
    }

    // Se está em modo de teste, simular a trade
    if (testMode || config.test_mode) {
      console.log('Test mode - simulating trade');
      
      // Buscar preço atual
      const priceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const priceData = await priceResponse.json();
      const currentPrice = parseFloat(priceData.price);

      // Registrar trade simulada
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          symbol,
          side,
          type,
          quantity: parseFloat(quantity),
          price: currentPrice,
          status: 'EXECUTED',
          executed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (tradeError) {
        console.error('Error saving simulated trade:', tradeError);
      }

      // Registrar log
      await supabase.from('bot_logs').insert({
        user_id: user.id,
        level: 'SUCCESS',
        message: `Trade simulada executada: ${side} ${quantity} ${symbol} @ ${currentPrice}`,
        details: { testMode: true, trade }
      });

      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          trade: {
            orderId: `TEST_${Date.now()}`,
            symbol,
            side,
            quantity,
            price: currentPrice,
            status: 'EXECUTED'
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // MODO REAL - Executar na Binance
    if (!config.api_key_encrypted || !config.api_secret_encrypted) {
      throw new Error('API credentials not configured');
    }

    const apiKey = decrypt(config.api_key_encrypted);
    const apiSecret = decrypt(config.api_secret_encrypted);

    // Preparar parâmetros da ordem
    const timestamp = Date.now();
    const params: Record<string, string> = {
      symbol,
      side,
      type,
      quantity: quantity.toString(),
      timestamp: timestamp.toString(),
    };

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const signature = generateSignature(queryString, apiSecret);
    const signedQuery = `${queryString}&signature=${signature}`;

    // Executar ordem na Binance
    const binanceResponse = await fetch(
      `https://api.binance.com/api/v3/order?${signedQuery}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      }
    );

    const binanceData = await binanceResponse.json();

    if (!binanceResponse.ok) {
      throw new Error(`Binance API error: ${JSON.stringify(binanceData)}`);
    }

    // Registrar trade real
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        symbol,
        side,
        type,
        quantity: parseFloat(quantity),
        price: parseFloat(binanceData.price || 0),
        status: 'EXECUTED',
        binance_order_id: binanceData.orderId?.toString(),
        executed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error saving real trade:', tradeError);
    }

    // Registrar log
    await supabase.from('bot_logs').insert({
      user_id: user.id,
      level: 'SUCCESS',
      message: `Trade executada: ${side} ${quantity} ${symbol}`,
      details: { testMode: false, trade, binanceData }
    });

    console.log('Trade executed successfully:', binanceData);

    return new Response(
      JSON.stringify({
        success: true,
        testMode: false,
        trade: binanceData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in binance-execute-trade:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to execute trade'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
