import sys
sys.stdout.reconfigure(encoding='utf-8')
import pandas as pd
import re
import os
from datetime import datetime

PLANILHA = 'Pessoa - 30-06-2026 10-07.xlsx'
SAIDA    = f'contatos_catedral_{datetime.now().strftime("%d-%m-%Y")}.vcf'

DATAS_ATIVO = ['31/12/9999', '11/02/2099']

def is_ativo(data_demissao, base):
    base = str(base or '').strip().upper()
    if base == 'DESLIGADOS':
        return False
    data = str(data_demissao or '').strip()
    if not data or data in DATAS_ATIVO:
        return True
    partes = data.split('/')
    if len(partes) == 3:
        try:
            from datetime import date
            d = date(int(partes[2]), int(partes[1]), int(partes[0]))
            if d < date.today():
                return False
        except:
            pass
    return True

def normalizar_celular(valor):
    if pd.isna(valor):
        return None
    n = str(int(round(float(valor)))) if isinstance(valor, float) else str(valor)
    n = re.sub(r'\D', '', n)
    if len(n) in (10, 11):
        n = '55' + n
    if len(n) not in (12, 13):
        return None
    return '+' + n

print('Lendo planilha...')
df = pd.read_excel(PLANILHA, header=1)

vcf_linhas = []
total = 0
sem_numero = 0
desligados = 0

for _, row in df.iterrows():
    nome      = str(row.get('Nome', '') or '').strip()
    matricula = str(row.get('Matrícula', '') or '').strip()
    base      = str(row.get('Base Operacional', '') or '').strip()
    celular   = normalizar_celular(row.get('Celular') or row.get('Telefone'))
    demissao  = row.get('Data de Demissão', '')

    if not nome:
        continue

    if not is_ativo(demissao, base):
        desligados += 1
        continue

    if not celular:
        sem_numero += 1
        continue

    # Padrão: MATRICULA - NOME - BASE
    nome_contato = f'{matricula} - {nome} - {base}'

    vcf_linhas.append('BEGIN:VCARD')
    vcf_linhas.append('VERSION:3.0')
    vcf_linhas.append(f'FN:{nome_contato}')
    vcf_linhas.append(f'N:{nome};;;{matricula};')
    vcf_linhas.append(f'TEL;TYPE=CELL:{celular}')
    vcf_linhas.append(f'ORG:Viação Catedral;{base}')
    vcf_linhas.append('END:VCARD')
    vcf_linhas.append('')
    total += 1

with open(SAIDA, 'w', encoding='utf-8') as f:
    f.write('\n'.join(vcf_linhas))

print(f'\n✅ Arquivo gerado: {SAIDA}')
print(f'   Contatos gerados:  {total}')
print(f'   Sem número:        {sem_numero}')
print(f'   Desligados:        {desligados}')
print(f'\n📲 Como importar:')
print(f'   1. Transfira o arquivo "{SAIDA}" para o celular')
print(f'   2. Abra o arquivo no celular → "Importar contatos"')
print(f'   3. O WhatsApp reconhece automaticamente os novos nomes')
