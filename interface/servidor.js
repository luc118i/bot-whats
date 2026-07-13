const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PORTA = 3000;
const RAIZ = path.join(__dirname, '..');
const PLANILHA = path.join(RAIZ, 'Pessoa - 30-06-2026 10-07.xlsx');
const PROGRESSO = path.join(RAIZ, 'progresso.json');
const MODELO = path.join(RAIZ, 'motoristas_sem_numero.xlsx');

// ─── LER MOTORISTAS DA PLANILHA ──────────────────────────────────
function lerMotoristas() {
    const wb = XLSX.readFile(PLANILHA);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1 });
}

// ─── STATS ───────────────────────────────────────────────────────
function calcularStats() {
    const rows = lerMotoristas();
    const header = rows[1];
    const idxNome     = header.indexOf('Nome');
    const idxCelular  = header.indexOf('Celular');
    const idxTelefone = header.indexOf('Telefone');

    let total = 0, semNumero = 0;
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r[idxNome]) continue;
        total++;
        if (!r[idxCelular] && !r[idxTelefone]) semNumero++;
    }

    let enviados = 0, pendentes = 0;
    if (fs.existsSync(PROGRESSO)) {
        const p = JSON.parse(fs.readFileSync(PROGRESSO, 'utf8'));
        enviados  = Object.values(p).filter(v => v.status === 'ENVIADO').length;
        pendentes = Object.values(p).filter(v => v.status === 'FALHOU').length;
    }

    return { total, enviados, semNumero, pendentes };
}

// ─── ATUALIZAR NÚMEROS NA PLANILHA ───────────────────────────────
function atualizarNumeros(motoristasNovos) {
    const wb = XLSX.readFile(PLANILHA);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const header = rows[1];
    const idxMatricula = header.indexOf('Matrícula');
    const idxCelular   = header.indexOf('Celular');
    const idxTelefone  = header.indexOf('Telefone');

    // Mapa matrícula → linha
    const mapaLinhas = {};
    for (let i = 2; i < rows.length; i++) {
        const mat = String(rows[i][idxMatricula] || '').trim();
        if (mat) mapaLinhas[mat] = i;
    }

    let atualizados = 0, naoEncontrados = 0;

    for (const m of motoristasNovos) {
        const mat = String(m.matricula).trim();
        const cel = String(m.celular).replace(/\D/g, '');

        if (mapaLinhas[mat] !== undefined) {
            const rowIdx = mapaLinhas[mat];
            rows[rowIdx][idxCelular]  = cel;
            rows[rowIdx][idxTelefone] = cel;
            atualizados++;
        } else {
            naoEncontrados++;
        }
    }

    // Reescreve a planilha
    const novoWs = XLSX.utils.aoa_to_sheet(rows);
    wb.Sheets[wb.SheetNames[0]] = novoWs;
    XLSX.writeFile(wb, PLANILHA);

    // Remove do progresso.json os que agora têm número (para o bot enviar)
    if (fs.existsSync(PROGRESSO)) {
        const prog = JSON.parse(fs.readFileSync(PROGRESSO, 'utf8'));
        for (const m of motoristasNovos) {
            const mat = String(m.matricula).trim();
            if (prog[mat] && prog[mat].status === 'SEM_NUMERO') {
                delete prog[mat]; // libera para o bot enviar
            }
        }
        fs.writeFileSync(PROGRESSO, JSON.stringify(prog, null, 2), 'utf8');
    }

    return { atualizados, naoEncontrados };
}

// ─── SERVIDOR HTTP ───────────────────────────────────────────────
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    // ── API: stats
    if (url === '/api/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(calcularStats()));
        return;
    }

    // ── API: atualizar números
    if (url === '/api/atualizar' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { motoristas } = JSON.parse(body);
                const resultado = atualizarNumeros(motoristas);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, ...resultado }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, erro: e.message }));
            }
        });
        return;
    }

    // ── Baixar modelo
    if (url === '/baixar-modelo') {
        if (fs.existsSync(MODELO)) {
            res.writeHead(200, {
                'Content-Type': MIME['.xlsx'],
                'Content-Disposition': 'attachment; filename="motoristas_sem_numero.xlsx"'
            });
            fs.createReadStream(MODELO).pipe(res);
        } else {
            res.writeHead(404); res.end('Arquivo não encontrado');
        }
        return;
    }

    // ── Arquivos estáticos
    const filePath = url === '/' ? path.join(__dirname, 'index.html') : path.join(__dirname, url);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
    });
});

server.listen(PORTA, () => {
    console.log(`\n✅ Interface rodando em: http://localhost:${PORTA}\n`);
});
