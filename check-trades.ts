import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrades() {
    const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

    console.log('\n🔍 TRADES NO BANCO:', trades?.length || 0);

    if (!trades || trades.length === 0) {
        console.log('✅ Nenhuma trade encontrada\n');
        return;
    }

    trades.forEach((t, i) => {
        console.log(`\n${i + 1}. ID: ${t.id.substring(0, 8)}...`);
        console.log(`   Symbol: ${t.symbol}`);
        console.log(`   Side: ${t.side}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Price: $${t.price}`);
        console.log(`   Quantity: ${t.quantity}`);
        console.log(`   P/L: ${t.profit_loss === null ? 'NULL (trade aberta)' : t.profit_loss}`);
        console.log(`   Created: ${new Date(t.created_at).toLocaleString()}`);
    });

    // Análise
    const buyTrades = trades.filter(t => t.side === 'BUY' && t.profit_loss === null);
    const allocatedCapital = buyTrades.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0);

    console.log('\n📊 ANÁLISE:');
    console.log(`   Trades BUY sem P/L: ${buyTrades.length}`);
    console.log(`   Capital Alocado: $${allocatedCapital.toFixed(2)}`);
    console.log(`   Posições Ativas DEVEM SER: ${buyTrades.length}\n`);
}

checkTrades();
