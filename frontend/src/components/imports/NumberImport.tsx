import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, Minus } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { atualizarNumeros } from '../../services/api'
import type { DriverRow } from '../../types'
import { useQueryClient } from '@tanstack/react-query'

function formatarCelular(raw: unknown): string | null {
  if (!raw) return null
  let n = String(raw).replace(/\D/g, '')
  if (!n) return null
  n = String(Math.round(Number(n))).replace(/\D/g, '')
  if (n.length === 10 || n.length === 11) n = '55' + n
  if (n.length < 12 || n.length > 13) return null
  return n
}

function parsePlanilha(file: File): Promise<DriverRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

        let headerIdx = -1
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i].some((c) => /matr/i.test(String(c)))) { headerIdx = i; break }
        }
        if (headerIdx === -1) throw new Error('Nao encontrei as colunas de Matricula e Nome.')

        const hdr = rows[headerIdx]
        const idxMat = hdr.findIndex((c) => /matr/i.test(String(c)))
        const idxNom = hdr.findIndex((c) => /nome/i.test(String(c)) && !/cracha/i.test(String(c)))
        const idxCel = hdr.findIndex((c) => /celular|telefone|fone|whats/i.test(String(c)))

        if (idxMat === -1 || idxNom === -1) throw new Error('Colunas de Matricula ou Nome nao encontradas.')

        const data: DriverRow[] = rows
          .slice(headerIdx + 1)
          .filter((r) => r[idxMat] || r[idxNom])
          .map((r) => ({
            matricula: String(r[idxMat] ?? '').trim(),
            nome: String(r[idxNom] ?? '').trim(),
            celularRaw: idxCel >= 0 ? String(r[idxCel] ?? '') : '',
            celular: formatarCelular(idxCel >= 0 ? r[idxCel] : ''),
          }))

        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export function NumberImport() {
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<DriverRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const data = await parsePlanilha(file)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo.')
      setRows([])
    }
  }

  async function handleAtualizar() {
    const payload = rows.filter((r) => r.celular)
    if (!payload.length) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await atualizarNumeros(
        payload.map((r) => ({ matricula: r.matricula, nome: r.nome, celular: r.celular! }))
      )
      if (res.ok) {
        setResult(`${res.atualizados ?? 0} numeros adicionados. ${res.naoEncontrados ?? 0} matriculas nao encontradas.`)
        await qc.invalidateQueries({ queryKey: ['stats'] })
      } else {
        setError(res.erro ?? 'Erro desconhecido.')
      }
    } catch {
      setError('Erro de conexao com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  const valid = rows.filter((r) => r.celular).length
  const invalid = rows.filter((r) => !r.celular && r.celularRaw).length
  const empty = rows.filter((r) => !r.celular && !r.celularRaw).length

  return (
    <div className="space-y-5">
      {/* How to use */}
      <Card className="p-6">
        <h2 className="font-bold text-gray-800 mb-4">Como usar</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['Baixe a planilha modelo e preencha a coluna Celular', 'Salve como .xlsx ou .csv', 'Importe aqui, confira a previa e clique em "Atualizar Lista"'] as const).map((txt, i) => (
            <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-brand text-white font-extrabold text-sm flex items-center justify-center mx-auto mb-3">
                {i + 1}
              </div>
              <p className="text-sm text-gray-600">{txt}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Drop zone */}
      <Card className="p-6">
        <h2 className="font-bold text-gray-800 mb-4">
          <span className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-gray-400" />Importar Arquivo</span>
        </h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-brand hover:bg-orange-50/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <Upload size={32} className="text-gray-300 mx-auto mb-3" />
          {fileName ? (
            <>
              <p className="font-semibold text-gray-700">{fileName}</p>
              <p className="text-xs text-gray-400 mt-1">Clique para trocar o arquivo</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-600">Arraste o arquivo aqui</p>
              <p className="text-xs text-gray-400 mt-1">ou clique para selecionar — aceita .csv ou .xlsx</p>
            </>
          )}
        </div>

        <div className="mt-4 bg-gray-50 rounded-xl p-4 text-xs text-gray-500 font-mono border border-gray-100">
          <strong className="text-gray-600">Formato esperado:</strong><br />
          Matricula | Nome | Celular (preencher)<br />
          5694 | ADAILSON BISPO | 16991234567
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}
        {result && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-medium">
            {result}
          </div>
        )}

        <div className="flex gap-3 mt-4 flex-wrap">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet size={15} />
            Selecionar arquivo
          </Button>
          <Button
            variant="primary"
            disabled={rows.length === 0 || valid === 0}
            loading={loading}
            onClick={handleAtualizar}
          >
            <CheckCircle2 size={15} />
            Atualizar Lista
          </Button>
          <Button variant="ghost" onClick={() => { window.location.href = '/baixar-modelo' }}>
            <Download size={15} />
            Baixar planilha modelo
          </Button>
        </div>
      </Card>

      {/* Preview table */}
      {rows.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Previa</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} />{valid} validos</span>
              <span className="flex items-center gap-1 text-red-500"><XCircle size={12} />{invalid} invalidos</span>
              <span className="flex items-center gap-1 text-gray-400"><Minus size={12} />{empty} vazios</span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand text-white">
                  {['#', 'Matricula', 'Nome', 'Celular informado', 'Celular formatado', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-700">{row.matricula}</td>
                    <td className="px-4 py-2.5 text-gray-600">{row.nome}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{row.celularRaw || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{row.celular ? `+${row.celular}` : '—'}</td>
                    <td className="px-4 py-2.5">
                      {row.celular ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                          <CheckCircle2 size={10} /> Valido
                        </span>
                      ) : row.celularRaw ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                          <XCircle size={10} /> Invalido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">
                          <Minus size={10} /> Vazio
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
