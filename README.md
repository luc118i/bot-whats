# Catedral Bot — Painel de Campanhas WhatsApp

Plataforma de disparo em massa via WhatsApp para a Viação Catedral: um dashboard web (React) para criar, configurar, pausar/retomar e acompanhar **campanhas** de comunicação com motoristas, e um backend Node.js que orquestra o envio de fato via `whatsapp-web.js`, com isolamento de progresso por campanha, controles anti-bloqueio configuráveis e relatórios (PDF/Excel) ao final.

Não é um script de disparo único — é um sistema multi-campanha: várias campanhas independentes podem coexistir (rascunho, agendada, executando, pausada, finalizada), cada uma com seu próprio público-alvo, mensagens, imagem, delay e histórico de progresso, sem interferir umas nas outras.

---

## Destaques técnicos

Pontos do projeto que valem a leitura do código, não só da lista de features:

- **Progresso isolado por campanha** (`progresso/<id>.json`, um arquivo por campanha) em vez de um único arquivo de estado global. Isso eliminou uma classe inteira de bugs de concorrência: antes, pausar uma campanha enquanto outra rodava (ou um kill abrupto do processo) podia fazer o sistema "esquecer" quem já tinha recebido mensagem e reenviar duplicado.
- **Migração automática e silenciosa** de campanhas criadas antes dessa mudança de esquema: na primeira leitura, se não existe progresso no formato novo mas existe no formato antigo, o sistema migra sozinho — sem exigir passo manual nem quebrar campanhas em andamento.
- **Pausas longas canceláveis**: esperas de minutos/horas (`respiro`) são implementadas com checagem periódica de cancelamento em vez de um único `setTimeout` bloqueante — pedir para pausar o bot não fica preso esperando o fim de uma espera de 1 hora.
- **Variação temporal (±20%) e duas regras de respiro independentes** — uma por quantidade de envios, outra por tempo de relógio (o que disparar primeiro vale). Cadências e durações sempre idênticas criam um padrão fácil de detectar; aqui nada é um número fixo repetido.
- **Reaproveitamento de sessão autenticada**: o envio roda no próprio processo do servidor (não como subprocesso) para reutilizar uma sessão WhatsApp já conectada no painel, evitando abrir um segundo Chromium na mesma pasta de perfil (erro clássico do Puppeteer).
- **Analytics agregado sob demanda**: endpoint que varre todos os arquivos de progresso de todas as campanhas e agrega envios reais em buckets de tempo com granularidade adaptativa (1min → 1 dia, conforme o período pedido), alimentando um gráfico com zoom (scroll do mouse) e navegação por arraste — sem depender de um banco de séries temporais.
- **Log ao vivo persistente**: o painel reconecta ao stream de eventos (SSE) e hidrata o histórico salvo em disco ao carregar a página, então um F5 não apaga o que já aconteceu.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Backend / bot | Node.js, `whatsapp-web.js` (Puppeteer), servidor HTTP nativo (sem framework) |
| Dashboard | React 18 + TypeScript + Vite, TanStack Query, Recharts, Tailwind CSS, Framer Motion |
| Dados/planilha | `xlsx` / `exceljs` |
| Relatórios | `pdfkit` (PDF), `exceljs` (Excel) |
| Autenticação WhatsApp | QR Code via `qrcode-terminal` / `qrcode` |

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
npm run dev                  # backend/API na porta 3000
cd frontend && npm run dev   # dashboard na porta 5173
```

Telas do dashboard: **Campanhas** (criar, editar, duplicar, iniciar, pausar, retomar, cancelar), **Envios**, **Contatos**, **Templates** (variações de mensagem/CTA/rodapé), **Relatórios**, **Logs** (stream ao vivo + histórico) e **Configurações** (delays, pausas, respiro por quantidade e por tempo, limite por execução, contas WhatsApp vinculadas).

### Envio via linha de comando (sem dashboard)

```bash
npm run send        # 1 conta
npm run send:dual   # 2 contas em paralelo
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
│   ├── bot/                      ← Cliente WhatsApp, envio, print, worker, orquestração de campanha
│   ├── services/                 ← Campanhas, progresso (por campanha), planilha, templates, relatório
│   ├── utils/                    ← delay (com cancelamento/variação), mensagem, telefone
│   └── api/
│       ├── server.js             ← Servidor HTTP (porta 3000)
│       └── routes/               ← campanhas, contatos, config, contas, atividade, logs, etc.
├── frontend/                     ← Dashboard React (Vite + TypeScript)
├── scripts/
│   ├── send.js                   ← Ponto de entrada do bot de envio (CLI)
│   ├── retakeScreenshots.js
│   └── generateContacts.js
├── docs/                         ← Diagramas de arquitetura e changelog
├── output/                       ← prints/, relatorio/, contatos/ (gerados, não versionados)
├── progresso/                    ← Progresso de envio por campanha, um arquivo por id (gerado, não versionado)
├── campanhas_imagens/            ← Imagens customizadas por campanha (geradas, não versionadas)
├── campanhas.json                ← Estado das campanhas (gerado, não versionado)
└── package.json
```

> Arquivos com dados pessoais (planilha de motoristas, `.vcf`), estado de execução (`campanhas.json`, `progresso/`, `output/`) e a sessão autenticada do WhatsApp (`.wwebjs_auth/`) ficam fora do controle de versão — veja `.gitignore`.

---

## Fluxo Geral de uma Campanha

1. Criação (ou edição, a qualquer momento) pelo dashboard: nome, modelos de mensagem, imagem opcional, filtros de público (base operacional / status), delay entre envios e agendamento.
2. Ao iniciar, a campanha ganha seu próprio arquivo de progresso — isolado, sem herdar nem contaminar o estado de nenhuma outra campanha.
3. O bot lê a campanha ativa, filtra motoristas pelo público-alvo configurado, monta a mensagem a partir dos modelos da campanha + CTA + rodapé (sorteados de pools de variações, para reduzir padrões repetitivos) e envia, respeitando o delay configurado na campanha (ou o padrão global).
4. Cada envio: marca `PROCESSANDO` → verifica WhatsApp → envia imagem + legenda → tira print → marca `ENVIADO`. Um registro que fica travado em `PROCESSANDO` (por crash/encerramento abrupto) é retentado automaticamente na próxima execução, em vez de ficar órfão para sempre.
5. Pausas automáticas para reduzir risco de bloqueio: por quantidade de envios (curta e longa) e por tempo de relógio, todas com variação de ±20% e canceláveis a qualquer momento.
6. Ao finalizar ou cancelar, o relatório (PDF e/ou Excel) é gerado a partir do progresso da campanha.

> ⚠️ Mesmo com essas precauções, `whatsapp-web.js` é automação não-oficial — o número pode ser suspenso pelo WhatsApp a qualquer momento, independente da configuração de delay. Para uso recorrente em produção, considere migrar para a [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) oficial.

---

## Arquitetura Detalhada

Consulte `docs/ARCHITECTURE.md` para diagramas Mermaid da arquitetura geral e do fluxo do bot.
