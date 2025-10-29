import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol = 'BTCUSDT' } = await req.json();

    console.log(`Fetching price for ${symbol}`);

    // Buscar preço da Binance API (pública) com timeout de 5s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
        { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = await response.json();

      console.log(`Price fetched successfully: ${data.price}`);

      return new Response(
        JSON.stringify({
          symbol: data.symbol,
          price: parseFloat(data.price),
          timestamp: Date.now()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Se foi timeout (AbortError), retornar erro específico
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Binance API timeout after 5s');
        return new Response(
          JSON.stringify({ 
            error: 'Request timeout',
            details: 'Binance API não respondeu em 5 segundos'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 504 
          }
        );
      }
      
      throw fetchError; // Re-throw para ser capturado pelo catch externo
    }

  } catch (error) {
    console.error('Error in binance-get-price:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to fetch price from Binance',
        symbol: 'BTCUSDT' // fallback
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
