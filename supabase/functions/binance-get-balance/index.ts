import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
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

    // Decrypt credentials (simple XOR - same as in frontend)
    const encryptionKey = Deno.env.get("BINANCE_ENCRYPTION_KEY") || "default-key";
    
    const decrypt = (encrypted: string): string => {
      const encryptedBytes = new Uint8Array(
        encrypted.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      const keyBytes = new TextEncoder().encode(encryptionKey);
      const decrypted = new Uint8Array(encryptedBytes.length);

      for (let i = 0; i < encryptedBytes.length; i++) {
        decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
      }

      return new TextDecoder().decode(decrypted);
    };

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
      const errorText = await binanceResponse.text();
      console.error("Binance API error:", errorText);
      throw new Error(`Binance API error: ${binanceResponse.status}`);
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
    console.error("Error fetching balance:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
