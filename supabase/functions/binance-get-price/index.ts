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
    // Parse do corpo com segurança e validação do símbolo
    let symbol = 'BTCUSDT';
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body.symbol === 'string') {
        symbol = String(body.symbol).toUpperCase().trim();
      }
    } catch (_) {
      // Ignora erros de parse e mantém o símbolo padrão
    }

    // Validação simples do símbolo para evitar chamadas ruins ao upstream
    const isValid = /^[A-Z0-9]{5,15}$/.test(symbol);
    if (!isValid) {
      console.warn(`Invalid symbol received: ${symbol}`);
      return new Response(
        JSON.stringify({ error: 'Invalid symbol', details: 'Use um símbolo como BTCUSDT' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Fetching price for ${symbol}`);

    // Política de retries com backoff e timeout por tentativa
    const maxAttempts = 4;
    const baseTimeoutMs = 3000;
    const baseUrls = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com',
    ];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), baseTimeoutMs);

      try {
        const baseUrl = baseUrls[(attempt - 1) % baseUrls.length];
        console.log(`Attempt ${attempt} for ${symbol} via ${baseUrl}`);
        const response = await fetch(
          `${baseUrl}/api/v3/ticker/price?symbol=${symbol}`,
          {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const status = response.status;
          const text = await response.text().catch(() => '');
          console.warn(`Binance API error (status ${status}) on attempt ${attempt}: ${text}`);

          // Lida com rate limiting explicitamente
          if (status === 429 || status === 418 || status === 451) {
            const retryAfter = Number(response.headers.get('Retry-After')) || attempt; // segundos
            if (attempt < maxAttempts) {
              await new Promise(res => setTimeout(res, retryAfter * 1000));
              continue;
            }
            return new Response(
              JSON.stringify({ error: 'Upstream rate limited', details: 'Binance retornou 429/418/451' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
            );
          }

          // Para outros erros HTTP, tenta novamente e depois falha como bad gateway
          if (attempt < maxAttempts) {
            await new Promise(res => setTimeout(res, attempt * 500));
            continue;
          }

          return new Response(
            JSON.stringify({ error: 'Upstream error', details: `Status ${status}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
          );
        }

        const data = await response.json();

        if (!data || typeof data.price === 'undefined') {
          if (attempt < maxAttempts) {
            await new Promise(res => setTimeout(res, attempt * 300));
            continue;
          }
          return new Response(
            JSON.stringify({ error: 'Malformed upstream response' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
          );
        }

        console.log(`Price fetched successfully: ${data.price}`);

        return new Response(
          JSON.stringify({
            symbol: data.symbol ?? symbol,
            price: parseFloat(String(data.price)),
            timestamp: Date.now()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Timeout
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error(`Binance API timeout on attempt ${attempt}`);
          if (attempt < maxAttempts) {
            await new Promise(res => setTimeout(res, attempt * 500));
            continue;
          }
          return new Response(
            JSON.stringify({
              error: 'Request timeout',
              details: `Binance API não respondeu em ${baseTimeoutMs}ms (após ${maxAttempts} tentativas)`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 504 }
          );
        }

        // Erro de rede ou DNS, etc
        console.error(`Network error on attempt ${attempt}:`, fetchError);
        if (attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, attempt * 500));
          continue;
        }
        return new Response(
          JSON.stringify({
            error: 'Network error',
            details: 'Falha ao comunicar com a Binance após múltiplas tentativas'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        );
      }
    }

    // Safety fallback
    return new Response(
      JSON.stringify({ error: 'Unknown failure' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );

  } catch (error) {
    console.error('Error in binance-get-price:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to fetch price from Binance',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
