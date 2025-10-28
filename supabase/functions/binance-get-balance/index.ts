import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const encryptionKey = Deno.env.get('BINANCE_ENCRYPTION_KEY') || 'default-key';

// Server-side decryption
function decrypt(encrypted: string): string {
  const encryptedBytes = new Uint8Array(
    encrypted.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const decrypted = new Uint8Array(encryptedBytes.length);

  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return new TextDecoder().decode(decrypted);
}

// Check rate limit using database function
async function checkRateLimit(supabase: any, userId: string, endpoint: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_max_requests: 10, // Max 10 balance queries per minute
    p_window_seconds: 60
  });

  if (error) {
    console.error('Rate limit check error:', error);
    return false;
  }

  return data === true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the user from the authorization header
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(supabaseClient, user.id, 'binance-get-balance');
    if (!withinLimit) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait before checking balance again.',
          retryAfter: 60 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
          status: 429 
        }
      );
    }

    // Get user's bot configuration with API credentials
    const { data: config, error: configError } = await supabaseClient
      .from("bot_configurations")
      .select("api_key_encrypted, api_secret_encrypted")
      .eq("user_id", user.id)
      .single();

    if (configError || !config) {
      throw new Error("Bot configuration not found");
    }

    if (!config.api_key_encrypted || !config.api_secret_encrypted) {
      throw new Error("API credentials not configured");
    }

    const apiKey = decrypt(config.api_key_encrypted);
    const apiSecret = decrypt(config.api_secret_encrypted);

    // Get account balance from Binance
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    
    // Create signature using HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(queryString)
    );
    
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const binanceResponse = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
      {
        headers: {
          "X-MBX-APIKEY": apiKey,
        },
      }
    );

    if (!binanceResponse.ok) {
      console.error('Binance API Error: Status', binanceResponse.status);
      throw new Error('Failed to fetch balance from Binance');
    }

    const accountData = await binanceResponse.json();

    // Calculate total balance in USDT
    const balances = accountData.balances || [];
    const usdtBalance = balances.find((b: any) => b.asset === "USDT");
    const balance = parseFloat(usdtBalance?.free || "0") + parseFloat(usdtBalance?.locked || "0");

    return new Response(
      JSON.stringify({ 
        balance,
        timestamp: Date.now() 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in binance-get-balance');
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing your request' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});