const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { lerMotoristas } = require('./lerPlanilha');
const { gerarRelatorio } = require('./gerarRelatorio');

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────
const IMAGEM          = path.join(__dirname, '..', 'informativo.png');
const PASTA_PRINTS    = path.join(__dirname, '..', 'prints');
const ARQUIVO_PROGRESSO = path.join(__dirname, '..', 'progresso.json');

const DELAY_MIN        = 1000;       // mínimo 1s
const DELAY_MAX        = 50000;      // máximo 50s
const PAUSA_A_CADA     = 20;         // pausa longa a cada X envios
const PAUSA_LONGA      = 5 * 60000; // 5 minutos de descanso
const LIMITE_POR_CONTA = 50;         // máximo por conta por execução (0 = sem limite)

// Número de contas via argumento: "node index.js 2" para duas contas (padrão: 1)
const TOTAL_CONTAS = Math.min(Math.max(parseInt(process.argv[2]) || 1, 1), 2);
// ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(PASTA_PRINTS)) fs.mkdirSync(PASTA_PRINTS);

// ─── PROGRESSO (com lock para escrita simultânea) ─────────────────
const progressoLock = { locked: false, queue: [] };

function carregarProgresso() {
    if (fs.existsSync(ARQUIVO_PROGRESSO))
        return JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO, 'utf8'));
    return {};
}

function salvarProgresso(progresso) {
    fs.writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify(progresso, null, 2), 'utf8');
}

function marcarProgresso(matricula, dados) {
    // Leitura-escrita atômica para evitar conflito entre as duas contas
    const prog = carregarProgresso();
    prog[matricula] = { ...dados, enviadoEm: new Date().toLocaleString('pt-BR') };
    salvarProgresso(prog);
}
// ──────────────────────────────────────────────────────────────────

function montarMensagem(nome, matricula) {
    return `🚌 *VIAÇÃO CATEDRAL — INFORMATIVO AOS MOTORISTAS*

Olá, *${nome} — Matrícula: ${matricula}* 👋

⚠️ *ATENÇÃO, MOTORISTA!*

Reforçamos as regras sobre a *PARADA PARA REFEIÇÃO:*

⏱️ O tempo máximo de permanência é de *30 MINUTOS.*

🔑 *MANTENHA O VEÍCULO DESLIGADO* durante a parada de refeição e também nos terminais.

⚠️ *IMPORTANTE:* Se o veículo estiver distante do ponto de refeição por ocorrência na rota, a autorização para parar em outro ponto de apoio — cadastrado no sistema de GPS — será dada *EXCLUSIVAMENTE PELO GESTOR DA ÁREA.*`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function aleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delayAleatorio(prefixo) {
    const ms = aleatorio(DELAY_MIN, DELAY_MAX);
    console.log(`${prefixo} ⏳ Aguardando ${(ms / 1000).toFixed(1)}s...\n`);
    return sleep(ms);
}

// Simula comportamento humano: pequenas pausas imprevisíveis entre ações
function microPausa() {
    return sleep(aleatorio(300, 800));
}

async function tirarPrint(client, numero, nome, prefixo) {
    try {
        const page = client.pupPage;
        const nomeArquivo = nome.replace(/[^a-zA-Z0-9]/g, '_');
        const numeroLimpo = numero.replace('@c.us', '').replace('@lid', '');
        const caminhoArquivo = path.join(PASTA_PRINTS, `${nomeArquivo}_${numeroLimpo}.png`);

        // O chat mais recente sempre fica no topo da lista — clica nele
        await page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 6000 });
        const primeiroChat = await page.$('[data-testid="cell-frame-container"]');
        if (primeiroChat) await primeiroChat.click();

        // Aguarda o painel do chat abrir com mensagens
        await page.waitForSelector('#main .message-out', { timeout: 8000 });

        // Aguarda renderização completa
        await sleep(1500);

        // Print só do painel direito (#main)
        const chatPanel = await page.$('#main');
        if (chatPanel) {
            await chatPanel.screenshot({ path: caminhoArquivo });
        } else {
            await page.screenshot({ path: caminhoArquivo });
        }

        return caminhoArquivo;
    } catch (e) {
        console.log(`${prefixo} ⚠️  Print falhou: ${e.message}`);
        return null;
    }
}

// ─── WORKER DE UMA CONTA ──────────────────────────────────────────
async function rodarConta(contaId, lista, media) {
    const prefixo = `[CONTA ${contaId}]`;

    return new Promise((resolve) => {
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: `catedral-conta-${contaId}` }),
            puppeteer: {
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        client.on('qr', (qr) => {
            console.log(`\n${prefixo} 📱 Escaneie o QR Code com a CONTA ${contaId}:\n`);
            qrcode.generate(qr, { small: true });
        });

        client.on('authenticated', () => {
            console.log(`${prefixo} ✅ Autenticado!\n`);
        });

        client.on('auth_failure', () => {
            console.error(`${prefixo} ❌ Falha na autenticação.`);
            resolve([]);
        });

        client.on('disconnected', async (reason) => {
            console.log(`${prefixo} ⚠️  Desconectado: ${reason}`);
            if (reason === 'LOGOUT') {
                console.log(`${prefixo} 🔑 Sessão encerrada. Delete a pasta ".wwebjs_auth/session-catedral-conta-${contaId}" e escaneie o QR novamente.`);
            }
            resolve([]);
        });

        client.on('ready', async () => {
            console.log(`${prefixo} 🚀 Pronto! Processando ${lista.length} motoristas...\n`);

            const resultados = [];
            const limite = LIMITE_POR_CONTA > 0 ? Math.min(LIMITE_POR_CONTA, lista.length) : lista.length;

            if (LIMITE_POR_CONTA > 0 && lista.length > LIMITE_POR_CONTA) {
                console.log(`${prefixo} ⚠️  Limite de sessão: ${limite} de ${lista.length}\n`);
            }

            for (let i = 0; i < limite; i++) {
                const { nome, matricula, celular } = lista[i];
                console.log(`${prefixo} [${i + 1}/${limite}] 📤 ${nome} (${celular.replace('@c.us', '')})`);

                const resultado = {
                    nome, matricula,
                    celular: celular.replace('@c.us', ''),
                    conta: contaId,
                    status: '', print: null, erro: null
                };

                try {
                    // Marca como PROCESSANDO antes de qualquer ação
                    // → se o bot cair após enviar, não reenvia na próxima execução
                    marcarProgresso(matricula, { ...resultado, status: 'PROCESSANDO' });

                    await microPausa();
                    const numeroValido = await client.getNumberId(celular.replace('@c.us', ''));
                    await microPausa();

                    if (!numeroValido) {
                        resultado.status = 'SEM_WHATSAPP';
                        resultado.erro = 'Número não tem WhatsApp';
                        console.log(`${prefixo}   ⚠️  Sem WhatsApp.`);
                        marcarProgresso(matricula, resultado);
                    } else {
                        const idCorreto = numeroValido._serialized;

                        await microPausa();
                        await client.sendMessage(idCorreto, media, { caption: montarMensagem(nome, matricula) });
                        await sleep(aleatorio(1500, 3000));

                        const printPath = await tirarPrint(client, idCorreto, nome, prefixo);
                        resultado.status = 'ENVIADO';
                        resultado.print = printPath;
                        console.log(`${prefixo}   ✅ Enviado!`);
                        marcarProgresso(matricula, resultado);
                    }
                } catch (err) {
                    resultado.status = 'FALHOU';
                    resultado.erro = err.message;
                    console.log(`${prefixo}   ❌ Falhou: ${err.message}`);
                    // Remove o PROCESSANDO para permitir nova tentativa
                    marcarProgresso(matricula, resultado);
                }

                resultados.push(resultado);

                const enviados = resultados.filter(r => r.status === 'ENVIADO').length;
                if (i < limite - 1) {
                    if (enviados > 0 && enviados % PAUSA_A_CADA === 0) {
                        console.log(`${prefixo} ☕ Pausa de ${PAUSA_LONGA / 60000} minutos...\n`);
                        await sleep(PAUSA_LONGA);
                    } else {
                        await delayAleatorio(prefixo);
                    }
                }
            }

            console.log(`\n${prefixo} ✅ Concluído! Encerrando conta ${contaId}...\n`);
            try { await client.destroy(); } catch (_) {}
            resolve(resultados);
        });

        client.initialize();
    });
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════');
    console.log(`   BOT CATEDRAL — ${TOTAL_CONTAS} CONTA(S) EM PARALELO`);
    console.log('═══════════════════════════════════════════════\n');

    if (!fs.existsSync(IMAGEM)) {
        console.error(`❌ IMAGEM NÃO ENCONTRADA: ${IMAGEM}`);
        process.exit(1);
    }

    const motoristas = lerMotoristas();
    const progresso  = carregarProgresso();

    // Registra sem número
    for (const m of motoristas) {
        if (m.semNumero && !progresso[m.matricula]) {
            progresso[m.matricula] = {
                nome: m.nome, matricula: m.matricula, celular: null,
                status: 'SEM_NUMERO', print: null,
                erro: 'Número não cadastrado na planilha',
                enviadoEm: new Date().toLocaleString('pt-BR')
            };
        }
    }
    salvarProgresso(progresso);

    const jaEnviados = Object.values(progresso).filter(v => v.status === 'ENVIADO').length;
    const semNumero  = Object.values(progresso).filter(v => v.status === 'SEM_NUMERO').length;
    const semWpp     = Object.values(progresso).filter(v => v.status === 'SEM_WHATSAPP').length;

    const pendentesRaw = motoristas.filter(m => {
        if (m.semNumero) return false;
        const p = progresso[m.matricula];
        // Só envia quem nunca foi tentado ou falhou com erro
        // PROCESSANDO = já foi tentado (evita reenvio mesmo em crash)
        return !p || p.status === 'FALHOU';
    });

    // Deduplica por número de celular — evita enviar 2x para o mesmo número
    const numerosVistos = new Set();
    const pendentes = [];
    const duplicados = [];
    for (const m of pendentesRaw) {
        const num = m.celular.replace('@c.us', '');
        if (numerosVistos.has(num)) {
            duplicados.push(m);
            // Marca o duplicado no progresso para não tentar de novo
            marcarProgresso(m.matricula, {
                nome: m.nome, matricula: m.matricula, celular: num,
                status: 'DUPLICADO', print: null,
                erro: 'Número já existe para outro motorista na planilha'
            });
        } else {
            numerosVistos.add(num);
            pendentes.push(m);
        }
    }

    console.log(`📋 Total na planilha:  ${motoristas.length}`);
    console.log(`✅ Já enviados:        ${jaEnviados}`);
    console.log(`⚠️  Sem número:        ${semNumero}`);
    console.log(`⚠️  Sem WhatsApp:      ${semWpp}`);
    if (duplicados.length > 0)
        console.log(`🔁 Números duplicados: ${duplicados.length} (ignorados)`);
    console.log(`📤 Pendentes agora:    ${pendentes.length}`);
    console.log(`📱 Contas em uso:      ${TOTAL_CONTAS}\n`);

    if (duplicados.length > 0) {
        console.log('⚠️  DUPLICADOS ENCONTRADOS (mesmo número, motoristas diferentes):');
        duplicados.forEach(d => console.log(`   - ${d.nome} (${d.matricula}) → ${d.celular.replace('@c.us', '')}`));
        console.log();
    }

    if (pendentes.length === 0) {
        console.log('🎉 Todos os motoristas já receberam o informativo!');
        process.exit(0);
    }

    // Divide a lista igualmente entre as contas
    const listas = Array.from({ length: TOTAL_CONTAS }, () => []);
    pendentes.forEach((m, i) => listas[i % TOTAL_CONTAS].push(m));

    listas.forEach((lista, i) => {
        console.log(`  Conta ${i + 1}: ${lista.length} motoristas`);
    });
    console.log('\n⚠️  Dois navegadores vão abrir. Escaneie o QR Code de cada um com uma conta diferente.\n');

    const media = MessageMedia.fromFilePath(IMAGEM);

    // Roda as contas em paralelo
    const todoResultados = await Promise.all(
        listas.map((lista, i) => rodarConta(i + 1, lista, media))
    );

    // Relatório unificado
    console.log('\n═══════════════════════════════════════════════');
    console.log('   TODOS OS ENVIOS CONCLUÍDOS! Gerando PDF...');
    console.log('═══════════════════════════════════════════════\n');

    const progressoFinal = carregarProgresso();
    const todosResultados = motoristas.map(m => {
        const p = progressoFinal[m.matricula];
        return p || {
            nome: m.nome, matricula: m.matricula,
            celular: m.celular ? m.celular.replace('@c.us', '') : null,
            status: 'PENDENTE', print: null, erro: null
        };
    });

    gerarRelatorio(todosResultados);

    const env   = todosResultados.filter(r => r.status === 'ENVIADO').length;
    const sWpp  = todosResultados.filter(r => r.status === 'SEM_WHATSAPP').length;
    const sNum  = todosResultados.filter(r => r.status === 'SEM_NUMERO').length;
    const falha = todosResultados.filter(r => r.status === 'FALHOU').length;
    const pend  = todosResultados.filter(r => r.status === 'PENDENTE').length;

    console.log(`📊 RESUMO GERAL:`);
    console.log(`   ✅ Enviados:       ${env}`);
    console.log(`   ⚠️  Sem WhatsApp:  ${sWpp}`);
    console.log(`   ➖ Sem número:     ${sNum}`);
    console.log(`   ❌ Falhou:         ${falha}`);
    console.log(`   🕐 Pendentes:      ${pend}`);
    console.log(`   📋 Total:          ${motoristas.length}`);
    console.log('\n📄 Relatório PDF gerado na pasta "relatorio"');

    process.exit(0);
}

main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
