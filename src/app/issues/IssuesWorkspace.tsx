'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ISSUE_STATUS_LIST } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { IssueItem } from '@/lib/types'

function normalizeIssueRow(row: unknown): IssueItem | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (r.id == null) return null
  const id = typeof r.id === 'string' ? r.id : String(r.id)
  if (!id) return null
  const rawP = r.progress
  const p = typeof rawP === 'number' ? rawP : Number(rawP)
  const progress = Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : 0
  const noteRaw = r.progress_note
  const progress_note = typeof noteRaw === 'string' ? noteRaw : ''
  return {
    id,
    title: typeof r.title === 'string' ? r.title : '',
    body: typeof r.body === 'string' ? r.body : '',
    status: typeof r.status === 'string' ? r.status : '未着手',
    progress,
    progress_note,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  }
}

function normalizeStatus(s: string): string {
  return ISSUE_STATUS_LIST.includes(s as (typeof ISSUE_STATUS_LIST)[number]) ? s : '未着手'
}

type Draft = { title: string; body: string; status: string; progress: number; progress_note: string }

function emptyDraft(): Draft {
  return { title: '', body: '', status: '未着手', progress: 0, progress_note: '' }
}

function formatIssueDbError(raw: string): string {
  const m = raw.toLowerCase()
  const looksMissing =
    m.includes('issue_items') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist')) ||
    m.includes('could not find the table')
  if (looksMissing) {
    return [
      '課題データを読み込めませんでした（テーブルがまだありません）。',
      '',
      'Supabase の SQL Editor で次を実行してください:',
      'supabase/migrations/006_issue_items.sql',
    ].join('\n')
  }
  if (m.includes('progress_note')) {
    return [
      '課題テーブルに列 progress_note がありません。',
      '',
      'Supabase の SQL Editor で次を実行してください:',
      'supabase/migrations/007_issue_items_progress_note.sql',
    ].join('\n')
  }
  return raw
}

export function IssuesWorkspace() {
  const supabase = useMemo(() => createClient(), [])
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [creating, setCreating] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const loadIssues = useCallback(async () => {
    setLoading(true)
    setPageError(null)
    const { data, error } = await supabase.from('issue_items').select('*').order('updated_at', { ascending: false })
    if (error) {
      setPageError(formatIssueDbError(error.message))
      setIssues([])
      setLoading(false)
      return
    }
    const rows = ((data ?? []) as unknown[])
      .map((row) => normalizeIssueRow(row))
      .filter((x): x is IssueItem => x != null)
    setIssues(rows)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadIssues()
  }, [loadIssues])

  const selected = useMemo(() => issues.find((i) => i.id === selectedId) ?? null, [issues, selectedId])

  useEffect(() => {
    setShowCloseConfirm(false)
  }, [selectedId])

  const hasDetailUnsavedChanges = useMemo(() => {
    if (!selected) return false
    const rowStatus = normalizeStatus(selected.status)
    return (
      draft.title !== selected.title ||
      draft.body !== selected.body ||
      draft.status !== rowStatus ||
      draft.progress !== selected.progress ||
      draft.progress_note !== selected.progress_note
    )
  }, [selected, draft])

  const { activeIssues, completedIssues } = useMemo(() => {
    const active: IssueItem[] = []
    const done: IssueItem[] = []
    for (const i of issues) {
      if (normalizeStatus(i.status) === '完了') done.push(i)
      else active.push(i)
    }
    return { activeIssues: active, completedIssues: done }
  }, [issues])
  /** 一覧の再取得でドラフトが消えないよう、選択中の課題 ID が変わったときだけ一覧から流し込む */
  const lastHydratedIssueIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedId) {
      lastHydratedIssueIdRef.current = null
      setDraft(emptyDraft())
      return
    }
    if (lastHydratedIssueIdRef.current === selectedId) {
      return
    }
    const row = issues.find((i) => i.id === selectedId)
    if (!row) return
    lastHydratedIssueIdRef.current = selectedId
    setDraft({
      title: row.title,
      body: row.body,
      status: normalizeStatus(row.status),
      progress: row.progress,
      progress_note: row.progress_note,
    })
  }, [selectedId, issues])

  const closePanel = () => {
    setShowCloseConfirm(false)
    setSelectedId(null)
    setSaveStatus('idle')
  }

  const requestClosePanel = () => {
    if (hasDetailUnsavedChanges) {
      setShowCloseConfirm(true)
      return
    }
    closePanel()
  }

  const saveDraft = async (): Promise<boolean> => {
    if (!selectedId) return false
    setSaveStatus('saving')
    setPageError(null)
    const { data, error } = await supabase
      .from('issue_items')
      .update({
        title: draft.title,
        body: draft.body,
        status: draft.status,
        progress: draft.progress,
        progress_note: draft.progress_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedId)
      .select('*')
      .single()

    if (error) {
      setSaveStatus('error')
      setPageError(formatIssueDbError(error.message))
      return false
    }
    const normalized = normalizeIssueRow(data)
    if (normalized) {
      setIssues((prev) => prev.map((x) => (x.id === selectedId ? normalized : x)))
    }
    setSaveStatus('saved')
    return true
  }

  const handleSaveAndClosePanel = async () => {
    const ok = await saveDraft()
    if (!ok) return
    closePanel()
  }

  const createIssue = async () => {
    setCreating(true)
    setPageError(null)
    const { data, error } = await supabase
      .from('issue_items')
      .insert({
        title: '新しい課題',
        body: '',
        status: '未着手',
        progress: 0,
        progress_note: '',
      })
      .select('*')
      .single()

    if (error) {
      setPageError(formatIssueDbError(error.message))
      setCreating(false)
      return
    }
    const normalized = normalizeIssueRow(data)
    if (normalized) {
      setIssues((prev) => [normalized, ...prev])
      setSelectedId(normalized.id)
    } else {
      setPageError('課題の作成に失敗しました（サーバーからの応答が不正でした）。')
    }
    setCreating(false)
  }

  const panelOpen = selectedId !== null
  const errorLooksLikeMissingTable = pageError?.includes('006_issue_items') ?? false

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <Link href="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            ← 一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">課題</h1>
          <button
            type="button"
            onClick={() => void createIssue()}
            disabled={creating}
            className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {creating ? '作成中…' : '新規課題'}
          </button>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6">
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

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中…</p>
        ) : issues.length === 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
            <li className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              課題がありません。「新規課題」から追加してください。
            </li>
          </ul>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                進行中の課題
              </h2>
              <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
                {activeIssues.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    進行中の課題はありません（すべて完了済み、または未作成です）。
                  </li>
                ) : (
                  activeIssues.map((issue) => {
                    const active = issue.id === selectedId
                    return (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(issue.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/80 ${
                            active ? 'bg-blue-50/80 dark:bg-blue-950/30' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                              {issue.title.trim() || '（無題）'}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                            <span className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                              {issue.status}
                            </span>
                            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">進捗 {issue.progress}%</span>
                          </div>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>

            {completedIssues.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  完了した課題
                </h2>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white opacity-95 dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
                  {completedIssues.map((issue) => {
                    const active = issue.id === selectedId
                    return (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(issue.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/80 ${
                            active ? 'bg-blue-50/80 dark:bg-blue-950/30' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                              {issue.title.trim() || '（無題）'}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                            <span className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                              {issue.status}
                            </span>
                            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">進捗 {issue.progress}%</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {panelOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25 transition-opacity dark:bg-black/40"
          aria-label="パネルを閉じる"
          onClick={requestClosePanel}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-zinc-200 bg-zinc-50 shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-700 dark:bg-zinc-950 sm:w-1/2 sm:max-w-[50vw] ${
          panelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        aria-hidden={!panelOpen}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">課題の詳細</h2>
          <button
            type="button"
            onClick={requestClosePanel}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {selected && (
            <div className="space-y-4">
              <div>
                <label htmlFor="issue-title" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  タイトル
                </label>
                <input
                  id="issue-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, title: e.target.value }))
                    setSaveStatus('idle')
                  }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="issue-body" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  本文
                </label>
                <textarea
                  id="issue-body"
                  value={draft.body}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, body: e.target.value }))
                    setSaveStatus('idle')
                  }}
                  rows={8}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="issue-status" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  ステータス
                </label>
                <select
                  id="issue-status"
                  value={draft.status}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, status: e.target.value }))
                    setSaveStatus('idle')
                  }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {ISSUE_STATUS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="issue-progress" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  進捗（0〜100）
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="issue-progress"
                    type="range"
                    min={0}
                    max={100}
                    value={draft.progress}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, progress: Number(e.target.value) }))
                      setSaveStatus('idle')
                    }}
                    className="min-w-[8rem] flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.progress}
                    onChange={(e) => {
                      const n = Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)))
                      setDraft((d) => ({ ...d, progress: n }))
                      setSaveStatus('idle')
                    }}
                    className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">%</span>
                </div>
              </div>
              <div>
                <label htmlFor="issue-progress-note" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  進捗状況（テキスト）
                </label>
                <textarea
                  id="issue-progress-note"
                  value={draft.progress_note}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, progress_note: e.target.value }))
                    setSaveStatus('idle')
                  }}
                  rows={4}
                  placeholder="例: 設計レビュー待ち、ブロッカーなし など"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  保存
                </button>
                <p className="self-center text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
                  {saveStatus === 'saving' && '保存中…'}
                  {saveStatus === 'saved' && '保存しました'}
                  {saveStatus === 'error' && '保存に失敗しました'}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-close-confirm-title"
          onClick={() => setShowCloseConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="issue-close-confirm-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              変更を保存しますか？
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">保存していない内容は失われます。</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                保存せず閉じる
              </button>
              <button
                type="button"
                disabled={saveStatus === 'saving'}
                onClick={() => void handleSaveAndClosePanel()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {saveStatus === 'saving' ? '保存中…' : '保存して閉じる'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
