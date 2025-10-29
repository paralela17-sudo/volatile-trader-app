import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const encryptionKey = Deno.env.get('BINANCE_ENCRYPTION_KEY')!;

// Input validation schema
const TradeRequestSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9]{1,20}USDT$/, "Invalid trading symbol format"),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive().max(10000),
  type: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
  testMode: z.boolean().default(true)
});

// Server-side decryption using Web Crypto API
async function decrypt(encrypted: string): Promise<string> {
  const bytes = new Uint8Array(encrypted.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const decrypted = new Uint8Array(bytes.length);
  
  for (let i = 0; i < bytes.length; i++) {
    decrypted[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

// Generate HMAC SHA256 signature for Binance
function generateSignature(queryString: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(queryString);
  return hmac.digest("hex");
}

// Check rate limit using database function
async function checkRateLimit(supabase: any, userId: string, endpoint: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max_requests: 12, // Max 12 trades per minute (1 every 5 seconds)
      p_window_seconds: 60
    });

    if (error) {
      console.warn('Rate limit check error (allowing request):', error.message);
      // Se rate limit falhar, permitir a requisição para não bloquear operações
      return true;
    }

    return data === true;
  } catch (error) {
    console.warn('Rate limit check exception (allowing request):', error);
    // Se rate limit falhar, permitir a requisição
    return true;
  }
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
    
    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(supabase, user.id, 'binance-execute-trade');
    if (!withinLimit) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait before making another trade.',
          retryAfter: 60 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
          status: 429 
        }
      );
    }

    // Validate input (normalize symbol to uppercase)
    const rawBody = await req.json();
    const body = { ...rawBody, symbol: String(rawBody.symbol || '').toUpperCase().trim() };
    const validatedData = TradeRequestSchema.parse(body);
    const { symbol, side, quantity, type, testMode } = validatedData;
    const status = side === 'BUY' ? 'PENDING' : 'EXECUTED';

    console.log(`Executing trade request`);

    // Get user's bot configuration
    const { data: config, error: configError } = await supabase
      .from('bot_configurations')
      .select('api_key_encrypted, api_secret_encrypted, test_mode')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      throw new Error('Bot configuration not found');
    }

    // Test mode - simulate trade
    if (testMode || config.test_mode) {
      console.log('Test mode - simulating trade');
      
      // Get current price from Binance
      const priceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      if (!priceResponse.ok) {
        throw new Error('Failed to fetch current price');
      }
      const priceData = await priceResponse.json();
      const currentPrice = parseFloat(priceData.price);

      // Record simulated trade
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          symbol,
          side,
          type,
          quantity,
          price: currentPrice,
          status: status,
          executed_at: status === 'EXECUTED' ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (tradeError) {
        console.error('Error saving simulated trade');
      }

      // Log trade
      await supabase.from('bot_logs').insert({
        user_id: user.id,
        level: 'SUCCESS',
        message: `Simulated trade executed: ${side} ${quantity} ${symbol}`,
        details: { testMode: true, trade }
      });

      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          trade // return the DB trade record including id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // REAL MODE - Execute on Binance
    if (!config.api_key_encrypted || !config.api_secret_encrypted) {
      throw new Error('API credentials not configured');
    }

    const apiKey = await decrypt(config.api_key_encrypted);
    const apiSecret = await decrypt(config.api_secret_encrypted);

    // Prepare order parameters
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

    // Execute order on Binance
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
      console.error('Binance API Error: Status', binanceResponse.status);
      throw new Error('Failed to execute trade on Binance');
    }

    // Record real trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        symbol,
        side,
        type,
        quantity,
        price: parseFloat(binanceData.price || 0),
        status: status,
        binance_order_id: binanceData.orderId?.toString(),
        executed_at: status === 'EXECUTED' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error saving real trade');
    }

    // Log trade
    await supabase.from('bot_logs').insert({
      user_id: user.id,
      level: 'SUCCESS',
      message: `Trade executed: ${side} ${quantity} ${symbol}`,
      details: { testMode: false, trade }
    });

    console.log('Trade executed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        testMode: false,
        trade // return the DB trade record including id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in binance-execute-trade');
    
    // Handle validation errors specifically
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid trade parameters',
          details: error.errors 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your request'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});