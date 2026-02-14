import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
    console.log('🔍 DIAGNÓSTICO DE DADOS\n');

    // 1. Verificar trades
    const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('📊 TRADES NO SUPABASE:');
    if (!trades || trades.length === 0) {
        console.log('  ✅ Nenhuma trade (banco limpo)\n');
    } else {
        console.log(`  ⚠️ ${trades.length} trades encontradas:\n`);
        trades.forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.symbol} | ${t.side} | P/L: ${t.profit_loss || 'NULL'}`);
            console.log(`     Price: $${t.price} | Qty: ${t.quantity} | Status: ${t.status}`);
            console.log(`     Created: ${new Date(t.created_at).toLocaleString()}\n`);
        });
    }

    // 2. Verificar config
    const { data: config } = await supabase
        .from('bot_configs')
        .select('*')
        .limit(1);

    console.log('⚙️ BOT CONFIG:');
    if (config && config[0]) {
        console.log(`  test_mode: ${config[0].test_mode}`);
        console.log(`  test_balance: $${config[0].test_balance}`);
        console.log(`  is_powered_on: ${config[0].is_powered_on}`);
        console.log(`  is_running: ${config[0].is_running}\n`);
    } else {
        console.log('  ❌ Nenhuma configuração encontrada\n');
    }

    // 3. Sugestão
    if (trades && trades.length > 0) {
        console.log('💡 PROBLEMA IDENTIFICADO:');
        console.log('   Há trades antigas no banco que não deveriam estar lá.');
        console.log('   Essas trades estão sendo mostradas no Dashboard.\n');
        console.log('✅ SOLUÇÃO: Deletar essas trades antigas.');
    }
}

debugData();
