'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MEMBERS_LIST } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

type KnowledgeEntry = {
  id: string
  title: string
  author: string
  body: string
}

const AUTHOR_PLACEHOLDER = '記入者'

/** プルダウン幅（最長のメンバー名＋プレースホルダ＋矢印分の余白） */
const MEMBER_SELECT_WIDTH_CH =
  Math.max(...MEMBERS_LIST.map((n) => n.length), AUTHOR_PLACEHOLDER.length) + 3

const DOC_KEY = 'main'

function newEntry(): KnowledgeEntry {
  return { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, title: '', author: '', body: '' }
}

/** テーブル未作成時の PostgREST メッセージを分かりやすくする */
function formatKnowledgeDbError(raw: string, kind: 'load' | 'save'): string {
  const m = raw.toLowerCase()
  const looksMissing =
    m.includes('knowledge_documents') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist')) ||
    m.includes('could not find the table')
  if (looksMissing) {
    return [
      kind === 'load' ? '知識データを読み込めませんでした（テーブルがまだありません）。' : '保存できませんでした（テーブルがまだありません）。',
      '',
      'Supabase の SQL Editor で、次のマイグレーションを実行してください:',
      'supabase/migrations/005_knowledge_documents.sql',
      '',
      '実行後、ダッシュボードで「Reload schema」や数分待ってからページを再読み込みしてください。',
    ].join('\n')
  }
  return raw
}

export function KnowledgeEditor() {
  const router = useRouter()
  const [entries, setEntries] = useState<KnowledgeEntry[]>(() => [newEntry()])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const savedSnapshotRef = useRef('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('entries')
        .eq('doc_key', DOC_KEY)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setPageError(formatKnowledgeDbError(error.message, 'load'))
        return
      }

      if (!data) {
        const initial = [newEntry()]
        setEntries(initial)
        savedSnapshotRef.current = JSON.stringify(initial)
        setPageError(null)
        return
      }

      const raw = data.entries as unknown
      let next: KnowledgeEntry[] = [newEntry()]
      if (Array.isArray(raw) && raw.length > 0) {
        const normalized = raw
          .filter((row) => row && typeof row === 'object')
          .map((row) => {
            const r = row as Record<string, unknown>
            const id = typeof r.id === 'string' && r.id ? r.id : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
            const authorRaw = typeof r.author === 'string' ? r.author : ''
            const author = MEMBERS_LIST.includes(authorRaw as (typeof MEMBERS_LIST)[number])
              ? authorRaw
              : ''
            return {
              id,
              title: typeof r.title === 'string' ? r.title : '',
              author,
              body: typeof r.body === 'string' ? r.body : '',
            }
          })
        if (normalized.length > 0) next = normalized
      }
      setEntries(next)
      savedSnapshotRef.current = JSON.stringify(next)
      setPageError(null)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const hasUnsavedChanges = () => JSON.stringify(entries) !== savedSnapshotRef.current

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(entries) === savedSnapshotRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [entries])

  const addRow = () => {
    setEntries((prev) => [newEntry(), ...prev])
    setSaveStatus('idle')
  }

  const updateRow = (id: string, field: 'title' | 'body' | 'author', value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
    setSaveStatus('idle')
  }

  const saveDraft = async (): Promise<boolean> => {
    setSaveStatus('saving')
    setPageError(null)
    const { error } = await supabase.from('knowledge_documents').upsert(
      {
        doc_key: DOC_KEY,
        entries,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'doc_key' }
    )
    if (error) {
      setSaveStatus('error')
      setPageError(formatKnowledgeDbError(error.message, 'save'))
      return false
    }
    savedSnapshotRef.current = JSON.stringify(entries)
    setSaveStatus('saved')
    return true
  }

  const handleBackClick = () => {
    if (hasUnsavedChanges()) {
      setShowLeaveConfirm(true)
      return
    }
    router.push('/')
  }

  const handleSaveAndBack = async () => {
    const ok = await saveDraft()
    if (!ok) return
    setShowLeaveConfirm(false)
    router.push('/')
  }

  const errorLooksLikeMissingTable =
    pageError?.includes('005_knowledge_documents') ?? false

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBackClick}
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            ← 一覧に戻る
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">知識</h1>
          <button
            type="button"
            onClick={() => void saveDraft()}
            className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            保存
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          チーム向けの短いメモです。新しい行は上に追加されます。
        </p>

        {pageError && (
          <p
            className={`mb-4 whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
              errorLooksLikeMissingTable
                ? 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {pageError}
          </p>
        )}

        <div className="mb-3">
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
          >
            + 行を追加
          </button>
        </div>

        <div className="space-y-4">
          {entries.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="mb-3 flex min-w-0 flex-wrap items-stretch gap-2">
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => updateRow(row.id, 'title', e.target.value)}
                  placeholder="タイトル（例: LBのタイミング）"
                  aria-label="タイトル"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                <select
                  value={row.author}
                  onChange={(e) => updateRow(row.id, 'author', e.target.value)}
                  aria-label="入力者"
                  className="max-w-full shrink-0 rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                  style={{ width: `min(100%, ${MEMBER_SELECT_WIDTH_CH}ch)` }}
                >
                  <option value="">{AUTHOR_PLACEHOLDER}</option>
                  {MEMBERS_LIST.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={row.body}
                onChange={(e) => updateRow(row.id, 'body', e.target.value)}
                placeholder="本文（共有したい内容）"
                rows={2}
                aria-label="本文"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {saveStatus === 'saving' && '保存中…'}
          {saveStatus === 'saved' && '保存しました'}
          {saveStatus === 'error' && '保存に失敗しました（上記メッセージを確認してください）'}
        </p>

        {showLeaveConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-leave-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p id="knowledge-leave-title" className="mb-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                保存せずにページを離れようとしています。保存しますか？
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveAndBack()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  保存して戻る
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveConfirm(false)
                    router.push('/')
                  }}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  保存せず戻る
                </button>
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
