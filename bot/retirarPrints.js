const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const ARQUIVO_PROGRESSO = path.join(__dirname, '..', 'progresso.json');
const PASTA_PRINTS      = path.join(__dirname, '..', 'prints');

if (!fs.existsSync(PASTA_PRINTS)) fs.mkdirSync(PASTA_PRINTS);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function carregarProgresso() {
    return JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO, 'utf8'));
}

function salvarProgresso(p) {
    fs.writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify(p, null, 2), 'utf8');
}

// Pega todos ENVIADOS sem print válido
function listarSemPrint() {
    const prog = carregarProgresso();
    return Object.values(prog).filter(v =>
        v.status === 'ENVIADO' &&
        (!v.print || !fs.existsSync(v.print)) &&
        v.celular
    );
}

async function tirarPrint(page, celular, nome) {
    try {
        const nomeArquivo = nome.replace(/[^a-zA-Z0-9]/g, '_');
        const caminhoArquivo = path.join(PASTA_PRINTS, `${nomeArquivo}_${celular}.png`);

        // Clica no primeiro chat da lista (mais recente)
        await page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 6000 });

        // Procura o chat do motorista pelo número na lista
        const chatEncontrado = await page.evaluate((num) => {
            const itens = document.querySelectorAll('[data-testid="cell-frame-container"]');
            for (const item of itens) {
                const texto = item.innerText || '';
                // Pega os últimos 8 dígitos para comparar
                const ultimos = num.slice(-8);
                if (texto.includes(ultimos)) {
                    item.click();
                    return true;
                }
            }
            // Fallback: clica no primeiro
            if (itens[0]) { itens[0].click(); return true; }
            return false;
        }, celular);

        await page.waitForSelector('#main .message-out', { timeout: 8000 });
        await sleep(1500);

        const chatPanel = await page.$('#main');
        if (chatPanel) {
            await chatPanel.screenshot({ path: caminhoArquivo });
            return caminhoArquivo;
        }
    } catch (e) {
        console.log(`  ⚠️  Falhou: ${e.message}`);
    }
    return null;
}

async function main() {
    const semPrint = listarSemPrint();

    console.log('═══════════════════════════════════════════');
    console.log('   CATEDRAL — RETIRAR PRINTS PENDENTES    ');
    console.log('═══════════════════════════════════════════\n');
    console.log(`📋 Motoristas sem print: ${semPrint.length}\n`);

    if (semPrint.length === 0) {
        console.log('✅ Todos os enviados já têm print!');
        process.exit(0);
    }

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: 'catedral-conta-1' }),
        puppeteer: { headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    client.on('qr', (qr) => {
        console.log('\n📱 Escaneie o QR Code:\n');
        qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => console.log('✅ Autenticado!\n'));

    client.on('ready', async () => {
        console.log('🚀 Pronto! Tirando prints...\n');
        const page = client.pupPage;
        const prog = carregarProgresso();
        let ok = 0, falhou = 0;

        for (let i = 0; i < semPrint.length; i++) {
            const { nome, matricula, celular } = semPrint[i];
            console.log(`[${i + 1}/${semPrint.length}] 📸 ${nome}`);

            const printPath = await tirarPrint(page, celular, nome);

            if (printPath) {
                prog[matricula].print = printPath;
                salvarProgresso(prog);
                console.log(`  ✅ Print salvo!`);
                ok++;
            } else {
                falhou++;
            }

            if (i < semPrint.length - 1) await sleep(2000);
        }

        console.log(`\n📊 Resultado: ✅ ${ok} prints tirados | ❌ ${falhou} falharam`);
        try { await client.destroy(); } catch (_) {}
        process.exit(0);
    });

    client.on('auth_failure', () => { console.error('❌ Falha na autenticação.'); process.exit(1); });
    client.on('disconnected', () => { console.log('⚠️  Desconectado.'); process.exit(0); });

    await client.initialize();
}

main().catch(err => { console.error('Erro:', err); process.exit(1); });
