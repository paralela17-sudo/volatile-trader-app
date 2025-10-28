import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const encryptionKey = Deno.env.get('BINANCE_ENCRYPTION_KEY')!;

// Input validation
const CredentialsSchema = z.object({
  apiKey: z.string().min(10).max(200),
  apiSecret: z.string().min(10).max(200)
});

// Server-side encryption
function encrypt(text: string): string {
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const encrypted = new Uint8Array(textBytes.length);
  
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return Array.from(encrypted)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
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

    // Validate input
    const body = await req.json();
    const validatedData = CredentialsSchema.parse(body);
    const { apiKey, apiSecret } = validatedData;

    console.log('Storing API credentials for user');

    // Encrypt credentials server-side
    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    // Update bot configuration with encrypted credentials
    const { error: updateError } = await supabase
      .from('bot_configurations')
      .update({
        api_key_encrypted: encryptedKey,
        api_secret_encrypted: encryptedSecret
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating credentials');
      throw new Error('Failed to store credentials');
    }

    // Log the operation
    await supabase.from('bot_logs').insert({
      user_id: user.id,
      level: 'INFO',
      message: 'API credentials updated successfully',
      details: { timestamp: new Date().toISOString() }
    });

    console.log('API credentials stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'API credentials stored securely'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in store-api-credentials');
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid credentials format',
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