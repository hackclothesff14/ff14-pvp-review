'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAPS_LIST } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { OpponentTeamTactic } from '@/lib/types'
import {
  buildOpponentStatsSummary,
  compositionMultisetLabel,
  type ReviewRowForOpponentStats,
} from '@/lib/opponentReviewStats'

const COMPOSITION_RANKING_TOP = 15

type BasicSection = {
  id: string
  title: string
  content: string
}

const INITIAL_BASIC_SECTIONS: BasicSection[] = [
  { id: 'opening', title: '開幕の方針', content: '' },
  { id: 'call', title: 'コールルール', content: '' },
  { id: 'advantage', title: '有利/不利の判断', content: '' },
  { id: 'ot', title: 'OT時の優先順位', content: '' },
]
const TACTICS_DOC_KEY = 'main'

function normalizeOpponentRow(row: unknown): OpponentTeamTactic | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (r.id == null) return null
  const id = typeof r.id === 'string' ? r.id : String(r.id)
  return {
    id,
    team_name: typeof r.team_name === 'string' ? r.team_name : '',
    content: typeof r.content === 'string' ? r.content : '',
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  }
}

function formatOpponentDbError(raw: string): string {
  const m = raw.toLowerCase()
  const looksMissing =
    m.includes('opponent_team_tactics') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist')) ||
    m.includes('could not find the table')
  if (looksMissing) {
    return [
      '対戦チーム別データを読み込めません（テーブルがまだありません）。',
      '',
      'Supabase の SQL Editor で次を実行してください:',
      'supabase/migrations/008_opponent_team_tactics.sql',
    ].join('\n')
  }
  return raw
}

type TacticsDraft = {
  basicSections: BasicSection[]
  mapTactics: Record<string, string>
}

export function TacticsEditor() {
  const router = useRouter()
  const [basicSections, setBasicSections] = useState<BasicSection[]>(INITIAL_BASIC_SECTIONS)
  const [mapTactics, setMapTactics] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const savedSnapshotRef = useRef('')
  const supabase = useMemo(() => createClient(), [])
  const [opponentTeams, setOpponentTeams] = useState<OpponentTeamTactic[]>([])
  const [opponentLoading, setOpponentLoading] = useState(true)
  const [opponentSectionError, setOpponentSectionError] = useState<string | null>(null)
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const [opponentDraft, setOpponentDraft] = useState<{ team_name: string; content: string }>({
    team_name: '',
    content: '',
  })
  const [opponentSaveStatus, setOpponentSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [creatingOpponent, setCreatingOpponent] = useState(false)
  const [showOpponentCloseConfirm, setShowOpponentCloseConfirm] = useState(false)
  const lastHydratedOpponentIdRef = useRef<string | null>(null)
  const [reviewRowsForStats, setReviewRowsForStats] = useState<ReviewRowForOpponentStats[]>([])
  const [reviewsForStatsStatus, setReviewsForStatsStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [reviewsForStatsError, setReviewsForStatsError] = useState<string | null>(null)

  const emptyMapTactics = useMemo(
    () => Object.fromEntries(MAPS_LIST.map((mapName) => [mapName, ''])) as Record<string, string>,
    []
  )

  useEffect(() => {
    setMapTactics(emptyMapTactics)
  }, [emptyMapTactics])

  useEffect(() => {
    let cancelled = false
    const loadFromSupabase = async () => {
      const { data, error } = await supabase
        .from('tactics_documents')
        .select('basic_sections, map_tactics')
        .eq('doc_key', TACTICS_DOC_KEY)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setPageError(`戦術データの読み込みに失敗しました: ${error.message}`)
        return
      }

      if (!data) {
        const fallbackPayload: TacticsDraft = {
          basicSections: INITIAL_BASIC_SECTIONS,
          mapTactics: emptyMapTactics,
        }
        savedSnapshotRef.current = JSON.stringify(fallbackPayload)
        return
      }

      const rawBasicSections = data.basic_sections as unknown
      const rawMapTactics = data.map_tactics as unknown

      let nextBasicSections = INITIAL_BASIC_SECTIONS
      if (Array.isArray(rawBasicSections)) {
        const normalized = rawBasicSections
          .filter((s) => s && typeof (s as { id?: unknown }).id === 'string')
          .map((s) => ({
            id: String((s as { id: unknown }).id),
            title: typeof (s as { title?: unknown }).title === 'string' ? String((s as { title: unknown }).title) : '',
            content:
              typeof (s as { content?: unknown }).content === 'string'
                ? String((s as { content: unknown }).content)
                : '',
          }))
        if (normalized.length > 0) nextBasicSections = normalized
      }

      const nextMapTactics = { ...emptyMapTactics }
      if (rawMapTactics && typeof rawMapTactics === 'object') {
        for (const mapName of MAPS_LIST) {
          const value = (rawMapTactics as Record<string, unknown>)[mapName]
          nextMapTactics[mapName] = typeof value === 'string' ? value : ''
        }
      }

      setBasicSections(nextBasicSections)
      setMapTactics(nextMapTactics)
      savedSnapshotRef.current = JSON.stringify({
        basicSections: nextBasicSections,
        mapTactics: nextMapTactics,
      } satisfies TacticsDraft)
      setPageError(null)
    }

    void loadFromSupabase()
    return () => {
      cancelled = true
    }
  }, [emptyMapTactics, supabase])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setOpponentLoading(true)
      setOpponentSectionError(null)
      const { data, error } = await supabase.from('opponent_team_tactics').select('*').order('updated_at', {
        ascending: false,
      })
      if (cancelled) return
      if (error) {
        setOpponentSectionError(formatOpponentDbError(error.message))
        setOpponentTeams([])
        setOpponentLoading(false)
        return
      }
      const rows = ((data ?? []) as unknown[])
        .map((r) => normalizeOpponentRow(r))
        .filter((x): x is OpponentTeamTactic => x != null)
      setOpponentTeams(rows)
      setOpponentLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    setShowOpponentCloseConfirm(false)
  }, [selectedOpponentId])

  useEffect(() => {
    if (!selectedOpponentId) {
      lastHydratedOpponentIdRef.current = null
      setOpponentDraft({ team_name: '', content: '' })
      return
    }
    if (lastHydratedOpponentIdRef.current === selectedOpponentId) return
    const row = opponentTeams.find((o) => o.id === selectedOpponentId)
    if (!row) return
    lastHydratedOpponentIdRef.current = selectedOpponentId
    setOpponentDraft({ team_name: row.team_name, content: row.content })
    setOpponentSaveStatus('idle')
  }, [selectedOpponentId, opponentTeams])

  useEffect(() => {
    if (!selectedOpponentId) {
      setReviewRowsForStats([])
      setReviewsForStatsStatus('idle')
      setReviewsForStatsError(null)
      return
    }
    let cancelled = false
    setReviewsForStatsStatus('loading')
    setReviewsForStatsError(null)
    void (async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, review_date, record_type, opponent, matches')
        .order('review_date', { ascending: false })
        .limit(500)
      if (cancelled) return
      if (error) {
        setReviewsForStatsStatus('error')
        setReviewsForStatsError(error.message)
        setReviewRowsForStats([])
        return
      }
      setReviewRowsForStats((data ?? []) as ReviewRowForOpponentStats[])
      setReviewsForStatsStatus('idle')
    })()
    return () => {
      cancelled = true
    }
  }, [selectedOpponentId, supabase])

  const opponentStats = useMemo(
    () => buildOpponentStatsSummary(reviewRowsForStats, opponentDraft.team_name),
    [reviewRowsForStats, opponentDraft.team_name]
  )

  const isOpponentPanelDirty = useCallback((): boolean => {
    if (!selectedOpponentId) return false
    const row = opponentTeams.find((o) => o.id === selectedOpponentId)
    if (!row) return opponentDraft.team_name.trim() !== '' || opponentDraft.content.trim() !== ''
    return row.team_name !== opponentDraft.team_name || row.content !== opponentDraft.content
  }, [selectedOpponentId, opponentTeams, opponentDraft])

  const hasUnsavedChanges = useCallback(() => {
    const currentPayload: TacticsDraft = { basicSections, mapTactics }
    return JSON.stringify(currentPayload) !== savedSnapshotRef.current || isOpponentPanelDirty()
  }, [basicSections, mapTactics, isOpponentPanelDirty])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const addBasicSection = () => {
    const id = `custom-${Date.now()}`
    setBasicSections((prev) => [...prev, { id, title: '', content: '' }])
    setSaveStatus('idle')
  }

  const updateBasicSection = (id: string, field: 'title' | 'content', value: string) => {
    setBasicSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, [field]: value } : section))
    )
    setSaveStatus('idle')
  }

  const updateMapTactic = (mapName: string, value: string) => {
    setMapTactics((prev) => ({ ...prev, [mapName]: value }))
    setSaveStatus('idle')
  }

  const saveDraft = async (): Promise<boolean> => {
    setSaveStatus('saving')
    setPageError(null)
    const payload: TacticsDraft = { basicSections, mapTactics }
    const { error } = await supabase.from('tactics_documents').upsert(
      {
        doc_key: TACTICS_DOC_KEY,
        basic_sections: payload.basicSections,
        map_tactics: payload.mapTactics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'doc_key' }
    )
    if (error) {
      setSaveStatus('error')
      setPageError(`保存に失敗しました: ${error.message}`)
      return false
    }
    const serialized = JSON.stringify(payload)
    savedSnapshotRef.current = serialized
    setSaveStatus('saved')
    return true
  }

  const closeOpponentPanel = () => {
    setShowOpponentCloseConfirm(false)
    setSelectedOpponentId(null)
    setOpponentSaveStatus('idle')
  }

  const requestCloseOpponentPanel = () => {
    if (isOpponentPanelDirty()) {
      setShowOpponentCloseConfirm(true)
      return
    }
    closeOpponentPanel()
  }

  const saveOpponentDraft = async (): Promise<boolean> => {
    if (!selectedOpponentId) return false
    setOpponentSaveStatus('saving')
    setOpponentSectionError(null)
    const { data, error } = await supabase
      .from('opponent_team_tactics')
      .update({
        team_name: opponentDraft.team_name.trim(),
        content: opponentDraft.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedOpponentId)
      .select('*')
      .single()

    if (error) {
      setOpponentSaveStatus('error')
      setOpponentSectionError(formatOpponentDbError(error.message))
      return false
    }
    const normalized = normalizeOpponentRow(data)
    if (normalized) {
      setOpponentTeams((prev) =>
        [...prev.filter((x) => x.id !== normalized.id), normalized].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      )
      setOpponentDraft({ team_name: normalized.team_name, content: normalized.content })
      lastHydratedOpponentIdRef.current = selectedOpponentId
    }
    setOpponentSaveStatus('saved')
    return true
  }

  const createOpponent = async () => {
    setCreatingOpponent(true)
    setOpponentSectionError(null)
    const { data, error } = await supabase
      .from('opponent_team_tactics')
      .insert({
        team_name: '新しいチーム',
        content: '',
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      setOpponentSectionError(formatOpponentDbError(error.message))
      setCreatingOpponent(false)
      return
    }
    const normalized = normalizeOpponentRow(data)
    if (normalized) {
      setOpponentTeams((prev) => [normalized, ...prev])
      lastHydratedOpponentIdRef.current = null
      setSelectedOpponentId(normalized.id)
    }
    setCreatingOpponent(false)
  }

  const deleteOpponent = async () => {
    if (!selectedOpponentId) return
    if (!window.confirm('このチームのメモを削除しますか？')) return
    setOpponentSectionError(null)
    const id = selectedOpponentId
    const { error } = await supabase.from('opponent_team_tactics').delete().eq('id', id)
    if (error) {
      setOpponentSectionError(formatOpponentDbError(error.message))
      return
    }
    setOpponentTeams((prev) => prev.filter((o) => o.id !== id))
    closeOpponentPanel()
  }

  const handleSaveOpponentAndClose = async () => {
    const ok = await saveOpponentDraft()
    if (!ok) return
    setShowOpponentCloseConfirm(false)
    closeOpponentPanel()
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
    if (isOpponentPanelDirty() && selectedOpponentId) {
      const ok2 = await saveOpponentDraft()
      if (!ok2) return
    }
    setShowLeaveConfirm(false)
    router.push('/')
  }

  const opponentPanelOpen = selectedOpponentId !== null
  const selectedOpponent = selectedOpponentId
    ? opponentTeams.find((o) => o.id === selectedOpponentId) ?? null
    : null

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackClick}
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            ← 一覧に戻る
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">戦術</h1>
          <button
            type="button"
            onClick={() => void saveDraft()}
            className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saveStatus === 'saving' ? '保存中...' : '保存'}
          </button>
        </div>
        {pageError && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {pageError}
          </p>
        )}
        {saveStatus === 'saved' && (
          <p className="mb-4 text-right text-xs text-emerald-600 dark:text-emerald-400">
            保存しました（Supabase）
          </p>
        )}

        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">基本戦術</h2>
            <button
              type="button"
              onClick={addBasicSection}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + セクション追加
            </button>
          </div>
          <div className="space-y-3">
            {basicSections.map((section) => (
              <div key={section.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateBasicSection(section.id, 'title', e.target.value)}
                  placeholder="セクション名"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <textarea
                  value={section.content}
                  onChange={(e) => updateBasicSection(section.id, 'content', e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  rows={4}
                  placeholder="このセクションの方針を自由に記入"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">マップ別戦術</h2>
          <div className="space-y-3">
            {MAPS_LIST.map((mapName) => (
              <div
                key={mapName}
                className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-700"
              >
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{mapName}</p>
                <textarea
                  value={mapTactics[mapName] ?? ''}
                  onChange={(e) => updateMapTactic(mapName, e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  rows={4}
                  placeholder="開幕配置 / 優先フォーカス / ギミック前後の立ち回り / OT時の担当 などを自由に記入"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              対戦チーム別（戦略・対策）
            </h2>
            <button
              type="button"
              onClick={() => void createOpponent()}
              disabled={creatingOpponent || opponentLoading}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {creatingOpponent ? '作成中…' : '+ チームを追加'}
            </button>
          </div>
          {opponentSectionError && (
            <p className="mb-3 whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
              {opponentSectionError}
            </p>
          )}
          {opponentLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中…</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-zinc-50/50 dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/40">
              {opponentTeams.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  まだチームがありません。「+ チームを追加」から登録してください。
                </li>
              ) : (
                opponentTeams.map((t) => {
                  const active = t.id === selectedOpponentId
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedOpponentId(t.id)}
                        className={`flex w-full px-4 py-3 text-left text-sm font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800/80 ${
                          active ? 'bg-blue-50/80 dark:bg-blue-950/30' : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        <span className="truncate">{t.team_name.trim() || '（無名）'}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </section>

        {showLeaveConfirm && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tactics-leave-confirm-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p id="tactics-leave-confirm-title" className="mb-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                基本戦術・マップ別の編集、または開いている対戦チームメモに未保存の変更があります。保存してから戻りますか？
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

      {opponentPanelOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25 transition-opacity dark:bg-black/40"
          aria-label="パネルを閉じる"
          onClick={requestCloseOpponentPanel}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-zinc-200 bg-zinc-50 shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-700 dark:bg-zinc-950 sm:w-1/2 sm:max-w-[50vw] ${
          opponentPanelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        aria-hidden={!opponentPanelOpen}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {selectedOpponent ? '対戦チームメモ' : '読み込み中…'}
          </h2>
          <button
            type="button"
            onClick={requestCloseOpponentPanel}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {selectedOpponent && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4">
              <div>
                <label htmlFor="opponent-team-name" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  チーム名
                </label>
                <input
                  id="opponent-team-name"
                  type="text"
                  value={opponentDraft.team_name}
                  onChange={(e) => {
                    setOpponentDraft((d) => ({ ...d, team_name: e.target.value }))
                    setOpponentSaveStatus('idle')
                  }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="例: 〇〇チーム"
                />
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-100/50 p-3 dark:border-zinc-600 dark:bg-zinc-900/50">
                <h3 className="mb-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  過去の対戦（レビュー照合）
                </h3>
                <p className="mb-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  チーム名（前後の空白を除く）が、スクリムでは一覧の<strong>対戦相手</strong>、大会では各試合の<strong>対戦相手名</strong>と完全一致する試合のみ集計します。最新のレビューから最大500件を対象とします。
                  編成の集計では、試合ごとの相手ジョブを<strong>名前順に並べ替えて同一視</strong>します（席上の並び順は問いません）。
                </p>
                {reviewsForStatsStatus === 'loading' && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">レビューを読み込み中…</p>
                )}
                {reviewsForStatsError && (
                  <p className="text-xs text-red-600 dark:text-red-400">読み込みに失敗: {reviewsForStatsError}</p>
                )}
                {!opponentDraft.team_name.trim() && reviewsForStatsStatus !== 'loading' && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">チーム名を入力すると、戦績と編成の集計を表示します。</p>
                )}
                {opponentStats && (
                  <>
                    <dl className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950/60">
                        <dt className="text-zinc-500 dark:text-zinc-400">試合数</dt>
                        <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {opponentStats.totalMatches}
                        </dd>
                      </div>
                      <div className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950/60">
                        <dt className="text-zinc-500 dark:text-zinc-400">勝ち</dt>
                        <dd className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {opponentStats.wins}
                        </dd>
                      </div>
                      <div className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950/60">
                        <dt className="text-zinc-500 dark:text-zinc-400">負け</dt>
                        <dd className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                          {opponentStats.losses}
                        </dd>
                      </div>
                      <div className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950/60">
                        <dt className="text-zinc-500 dark:text-zinc-400">引き分け</dt>
                        <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {opponentStats.draws}
                        </dd>
                      </div>
                    </dl>
                    {opponentStats.otherResults > 0 && (
                      <p className="mb-3 text-[11px] text-amber-800 dark:text-amber-400">
                        「勝ち・負け・引き分け」以外の結果が {opponentStats.otherResults} 件含まれています。
                      </p>
                    )}
                    {opponentStats.totalMatches === 0 && reviewsForStatsStatus !== 'loading' && (
                      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">該当する試合はありません。</p>
                    )}
                    {opponentStats.recentHits.length > 0 && (
                      <div className="mb-3 border-t border-zinc-200/90 pt-3 dark:border-zinc-600">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                          直近の試合（最大10・新しい順）
                        </h4>
                        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                          {opponentStats.recentHits.map((h, i) => (
                            <li
                              key={`${h.reviewId}-${h.matchIndex}-${i}`}
                              className="flex flex-wrap gap-x-2 gap-y-0.5 text-zinc-700 dark:text-zinc-300"
                            >
                              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{h.reviewDate}</span>
                              <span className="min-w-0 truncate">{h.map || '（マップ未設定）'}</span>
                              <span className="font-medium">{h.result || '—'}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {opponentStats.jobRanking.length > 0 && (
                      <div className="mb-3 border-t border-zinc-200/90 pt-3 dark:border-zinc-600">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                          相手ジョブの出現回数（全該当試合）
                        </h4>
                        <ul className="flex flex-wrap gap-1.5">
                          {opponentStats.jobRanking.map(({ job, count }) => (
                            <li
                              key={job}
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                            >
                              {job}
                              <span className="ml-1 text-zinc-500 dark:text-zinc-400">×{count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {opponentStats.compositionRanking.length > 0 && (
                      <div className="mb-3 border-t border-zinc-200/90 pt-3 dark:border-zinc-600">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                          編成パターンの傾向（出現順・割合・最終出現日）
                        </h4>
                        <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          試合単位での集計です（割合は全該当試合数を分母）。上位
                          {COMPOSITION_RANKING_TOP} パターンを表示します。
                        </p>
                        <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
                          {opponentStats.compositionRanking
                            .slice(0, COMPOSITION_RANKING_TOP)
                            .map((row, i) => (
                              <li
                                key={`${row.label}-${i}`}
                                className="rounded-md border border-zinc-200/90 bg-white/80 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950/50"
                              >
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                                    {row.count}
                                    試合 / {row.percent.toFixed(1)}%
                                  </span>
                                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    最終出現: {row.lastSeen || '—'}
                                  </span>
                                </div>
                                <div className="mt-1 font-medium leading-snug text-zinc-900 dark:text-zinc-100">
                                  {row.label}
                                </div>
                              </li>
                            ))}
                        </ul>
                        {opponentStats.compositionRanking.length > COMPOSITION_RANKING_TOP && (
                          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            ほか{' '}
                            {opponentStats.compositionRanking.length - COMPOSITION_RANKING_TOP}{' '}
                            種類のパターンがあります。
                          </p>
                        )}
                      </div>
                    )}
                    {opponentStats.recentCompositions.length > 0 && (
                      <div className="border-t border-zinc-200/90 pt-3 dark:border-zinc-600">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                          直近の編成（最大5試合・新しい順）
                        </h4>
                        <ul className="space-y-2 text-xs">
                          {opponentStats.recentCompositions.map((h, i) => (
                            <li
                              key={`comp-${h.reviewId}-${h.matchIndex}-${i}`}
                              className="rounded-md border border-zinc-200/90 bg-white/70 px-2 py-1.5 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-200"
                            >
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {h.reviewDate}
                                {' · '}
                                {h.map || '—'}
                              </div>
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                {compositionMultisetLabel(h.opponentJobs)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <label htmlFor="opponent-team-content" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  戦略・対策メモ
                </label>
                <textarea
                  id="opponent-team-content"
                  value={opponentDraft.content}
                  onChange={(e) => {
                    setOpponentDraft((d) => ({ ...d, content: e.target.value }))
                    setOpponentSaveStatus('idle')
                  }}
                  placeholder="構成の傾向、割り振りの癖、読みで意識すること、試合での振り返りのリンクなど"
                  rows={12}
                  className="min-h-[12rem] w-full flex-1 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => void saveOpponentDraft()}
                  disabled={opponentSaveStatus === 'saving'}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {opponentSaveStatus === 'saving' ? '保存中…' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteOpponent()}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  削除
                </button>
                <p className="w-full text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
                  {opponentSaveStatus === 'saved' && '保存しました'}
                  {opponentSaveStatus === 'error' && '保存に失敗しました'}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {showOpponentCloseConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactics-opponent-close-title"
          onClick={() => setShowOpponentCloseConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="tactics-opponent-close-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              変更を保存しますか？
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">保存していない内容は失われます。</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowOpponentCloseConfirm(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={closeOpponentPanel}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                保存せず閉じる
              </button>
              <button
                type="button"
                disabled={opponentSaveStatus === 'saving'}
                onClick={() => void handleSaveOpponentAndClose()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {opponentSaveStatus === 'saving' ? '保存中…' : '保存して閉じる'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
