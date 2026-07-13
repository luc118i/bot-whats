const XLSX = require('xlsx');
const path = require('path');

// Data de demissão "ativa" usada pelo sistema
const DATAS_ATIVO = ['31/12/9999', '11/02/2099'];

function isAtivo(dataDemissao, baseOperacional) {
    const base = String(baseOperacional || '').trim().toUpperCase();
    if (base === 'DESLIGADOS') return false;

    const data = String(dataDemissao || '').trim();
    if (!data) return true; // sem data = considera ativo

    // Se a data está na lista de "ativo", é ativo
    if (DATAS_ATIVO.includes(data)) return true;

    // Se a data é uma data real no passado, está demitido
    const partes = data.split('/');
    if (partes.length === 3) {
        const dataObj = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
        if (!isNaN(dataObj) && dataObj < new Date()) return false;
    }

    return true;
}

function lerMotoristas() {
    const arquivo = path.join(__dirname, '..', 'Pessoa - 30-06-2026 10-07.xlsx');
    const wb = XLSX.readFile(arquivo);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const dados = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const header = dados[1];
    const idxNome      = header.indexOf('Nome');
    const idxMatricula = header.indexOf('Matrícula');
    const idxCelular   = header.indexOf('Celular');
    const idxTelefone  = header.indexOf('Telefone');
    const idxDemissao  = header.indexOf('Data de Demissão');
    const idxBase      = header.indexOf('Base Operacional');

    const motoristas = [];
    let desligados = 0;

    for (let i = 2; i < dados.length; i++) {
        const row = dados[i];
        const nome      = row[idxNome];
        const matricula = row[idxMatricula];

        if (!nome) continue;

        // Verifica se está ativo antes de qualquer coisa
        const ativo = isAtivo(row[idxDemissao], row[idxBase]);

        if (!ativo) {
            desligados++;
            continue; // ignora desligados — não entra na lista
        }

        let celular = row[idxCelular] || row[idxTelefone];

        if (!celular) {
            motoristas.push({
                nome: String(nome).trim(),
                matricula: String(matricula).trim(),
                celular: null,
                semNumero: true,
                ativo: true
            });
            continue;
        }

        celular = String(Math.round(Number(celular))).replace(/\D/g, '');

        if (celular.length === 10 || celular.length === 11) {
            celular = '55' + celular;
        }

        motoristas.push({
            nome: String(nome).trim(),
            matricula: String(matricula).trim(),
            celular: celular + '@c.us',
            semNumero: false,
            ativo: true
        });
    }

    if (desligados > 0) {
        console.log(`🚫 ${desligados} motorista(s) desligado(s) ignorado(s) automaticamente.\n`);
    }

    return motoristas;
}

module.exports = { lerMotoristas };
