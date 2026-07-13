# Documentação da API HTTP

O servidor da interface web expõe três rotas HTTP. Inicie com `npm run web` (porta 3000).

---

## GET /api/stats

Retorna estatísticas em tempo real sobre o progresso dos envios, cruzando a planilha com o `progresso.json`.

**Resposta (200 OK):**

```json
{
  "total": 320,
  "enviados": 145,
  "semNumero": 38,
  "pendentes": 12
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `total` | number | Total de motoristas ativos na planilha (excluindo desligados) |
| `enviados` | number | Motoristas com status `ENVIADO` no progresso.json |
| `semNumero` | number | Motoristas sem coluna Celular/Telefone preenchida na planilha |
| `pendentes` | number | Motoristas com status `FALHOU` (podem ser reenviados) |

---

## POST /api/atualizar

Atualiza os números de celular de motoristas diretamente na planilha principal e libera os registros `SEM_NUMERO` do progresso.json para reenvio.

**Body (application/json):**

```json
{
  "motoristas": [
    { "matricula": "5694", "celular": "16991234567" },
    { "matricula": "5197", "celular": "35998765432" }
  ]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `matricula` | string | Matrícula do motorista conforme consta na planilha |
| `celular` | string | Número com ou sem DDI (o sistema aceita 10–13 dígitos) |

**Resposta de sucesso (200 OK):**

```json
{
  "ok": true,
  "atualizados": 2,
  "naoEncontrados": 0
}
```

**Resposta de erro (500):**

```json
{
  "ok": false,
  "erro": "Mensagem descritiva do erro"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `atualizados` | number | Motoristas cujas colunas Celular/Telefone foram atualizadas na planilha |
| `naoEncontrados` | number | Matrículas enviadas que não foram localizadas na planilha |

---

## GET /baixar-modelo

Serve o arquivo `motoristas_sem_numero.xlsx` como download para o usuário preencher os números faltantes.

**Resposta de sucesso (200 OK):**

- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="motoristas_sem_numero.xlsx"`
- Body: stream binário do arquivo xlsx

**Resposta de erro (404):**

```
Arquivo não encontrado
```

O arquivo modelo deve estar em `motoristas_sem_numero.xlsx` na raiz do projeto. Ele é gerado separadamente e contém apenas os motoristas sem número cadastrado, com colunas: Matrícula, Nome, Celular (vazia para preenchimento).
