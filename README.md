# Catedral Bot — Painel de Campanhas WhatsApp

Plataforma de disparo em massa via WhatsApp para a Viação Catedral, com dashboard web para criar, configurar e acompanhar **campanhas** (não apenas o informativo de tempo de parada — qualquer campanha com mensagem, imagem e público-alvo próprios).

---

## Objetivo

Permitir a criação e edição de campanhas de comunicação com motoristas: definir 5 variações de mensagem personalizada (nome e matrícula), imagem opcional, filtro de público-alvo (base operacional, status de envio), delay entre envios e agendamento — tudo pelo dashboard, sem editar código. O bot então envia via WhatsApp Web, registra o progresso por campanha, tira prints de confirmação e gera relatório PDF.

Cada mensagem enviada combina: o modelo da campanha (ou um dos 5 modelos padrão do sistema) + um CTA + um rodapé, sorteados de pools de 5 variações cada (configuráveis em "Configurações"), para reduzir padrões repetitivos de envio em massa.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| Node.js | Runtime principal (backend + bot) |
| whatsapp-web.js | Automação do WhatsApp via Puppeteer |
| React + Vite + TypeScript | Dashboard web (`frontend/`) |
| xlsx | Leitura e escrita de planilhas Excel |
| pdfkit | Geração do relatório PDF |
| qrcode-terminal | Exibição do QR Code no terminal |

---

## Pré-requisitos

- Node.js >= 18
- Google Chrome ou Chromium instalado (usado pelo Puppeteer)
- Arquivo `informativo.png` na raiz do projeto (imagem padrão, usada quando a campanha não define uma própria)
- Planilha de motoristas na raiz do projeto (caminho configurado em `src/config/index.js`)

---

## Instalação

```bash
# Backend (raiz do projeto)
npm install

# Dashboard web
cd frontend && npm install
```

---

## Como Executar

### Dashboard web (criar e gerenciar campanhas)

```bash
npm run dev        # backend/API na porta 3000
cd frontend && npm run dev   # dashboard na porta 5173
```

Pelo dashboard: criar, **editar** (a qualquer momento, em qualquer status), duplicar, iniciar, pausar, retomar, cancelar campanhas e acompanhar estatísticas em tempo real. Editar reabre o mesmo wizard pré-preenchido com os dados atuais da campanha.

### Envio via linha de comando (sem dashboard)

```bash
npm run send        # 1 conta
npm run send:dual    # 2 contas em paralelo
```

Um navegador abrirá por conta **apenas na primeira vez** (para escanear o QR Code) — depois que a sessão é salva em `.wwebjs_auth/`, as próximas execuções rodam com o Chromium oculto (headless) automaticamente. Se houver uma campanha ativa no dashboard, o envio usa os modelos de mensagem, imagem, delay e filtros configurados nela; caso contrário, usa o padrão do sistema.

### Retirar prints pendentes

```bash
npm run retake
```

### Gerar arquivo de contatos VCF

```bash
npm run contacts
```

---

## Estrutura de Diretórios

```
INFORMATIVO DE TEMPO DE PARADA/
├── src/
│   ├── config/index.js          ← Constantes e caminhos centralizados
│   ├── bot/                      ← Cliente WhatsApp, envio, print, worker
│   ├── services/                 ← Campanhas, progresso, planilha, templates, relatório
│   ├── utils/                    ← delay, mensagem (padrão + customizada por campanha), telefone
│   └── api/
│       ├── server.js             ← Servidor HTTP (porta 3000)
│       └── routes/               ← campanhas, contatos, config, contas, stats, etc.
├── frontend/                     ← Dashboard React (Vite + TypeScript)
├── web/                          ← Interface estática legada (servida por src/api/server.js)
├── scripts/
│   ├── send.js                   ← Ponto de entrada do bot de envio
│   ├── retakeScreenshots.js
│   └── generateContacts.js
├── docs/                         ← Diagramas de arquitetura e changelog
├── output/                       ← prints/, relatorio/, contatos/ (gerados, não versionados)
├── campanhas_imagens/            ← Imagens customizadas por campanha (geradas, não versionadas)
├── snapshots/                    ← Snapshot do progresso ao finalizar/cancelar cada campanha
├── campanhas.json                ← Estado das campanhas (gerado, não versionado)
├── progresso.json                ← Estado de envio da campanha ativa (gerado, não versionado)
└── package.json
```

> Arquivos com dados pessoais (planilha de motoristas, `.vcf`), estado de execução (`campanhas.json`, `progresso.json`, `snapshots/`, `output/`) e a sessão autenticada do WhatsApp (`.wwebjs_auth/`) ficam fora do controle de versão — veja `.gitignore`.

---

## Fluxo Geral de uma Campanha

1. Criação (ou edição, a qualquer momento) pelo dashboard: nome, 5 modelos de mensagem, imagem opcional, filtros de público (base operacional / status), delay entre envios e agendamento.
2. Ao iniciar, o progresso é isolado — nenhum estado de campanhas anteriores é herdado (qualquer resíduo é arquivado antes do reset).
3. `send.js` lê a campanha ativa, filtra motoristas pelo público-alvo configurado, monta a mensagem a partir dos modelos da campanha + CTA + rodapé (ou do padrão do sistema, se nenhum modelo foi definido) e envia, respeitando o delay configurado na campanha (ou o padrão global, se não definido).
4. Cada envio: marca `PROCESSANDO` → verifica WhatsApp → envia imagem + legenda → tira print → marca `ENVIADO`.
5. Pausas automáticas para reduzir risco de bloqueio (a cada N envios / após M envios, um "respiro" maior).
6. Ao finalizar ou cancelar, o progresso é arquivado em `snapshots/{id}.json` e o relatório PDF é gerado.

> ⚠️ Mesmo com essas precauções, `whatsapp-web.js` é automação não-oficial — o número pode ser suspenso pelo WhatsApp a qualquer momento, independente da configuração de delay. Para uso recorrente em produção, considere migrar para a [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) oficial.

---

## Arquitetura Detalhada

Consulte `docs/ARCHITECTURE.md` para diagramas Mermaid da arquitetura geral e do fluxo do bot.
