'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAPS_LIST } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

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

  const hasUnsavedChanges = () => {
    const currentPayload: TacticsDraft = { basicSections, mapTactics }
    return JSON.stringify(currentPayload) !== savedSnapshotRef.current
  }

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const current = JSON.stringify({ basicSections, mapTactics } satisfies TacticsDraft)
      if (current === savedSnapshotRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [basicSections, mapTactics])

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

        {showLeaveConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tactics-leave-confirm-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p id="tactics-leave-confirm-title" className="mb-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                保存せずにページを離れようとしています。保存しますか？
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSaveAndBack}
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
