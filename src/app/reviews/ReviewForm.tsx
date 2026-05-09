'use client'

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Review } from '@/lib/types'
import {
  MEMBERS_LIST,
  JOBS_LIST,
  CUSTOM_MEMBER_VALUE,
  DEFAULT_MEMBER_ROWS,
  MAPS_LIST,
  RESULT_LIST,
  OT_SITUATION_LIST,
  CRYSTAL_PRE_OT_HALF_LIST,
  isCrystalPreOtHalfValue,
  parseMatchResults,
  serializeMatchResults,
  getDefaultMatch,
  parseVideoUrl,
  serializeVideos,
  getJobCategoryClass,
  getJobIconPath,
  type MemberJobPair,
  type MatchResult,
  type VideoEntry,
} from '@/lib/constants'

/** Supabase のスキーマ未反映時に分かりやすい文言を足す */
function formatSupabaseSaveError(message: string): string {
  if (message.includes('record_type') && message.includes('reviews')) {
    return `${message}\n\n【対処】Supabase の SQL Editor で \`supabase/migrations/004_reviews_record_type.sql\` を実行してください（README「Supabase（データベース）」参照）。`
  }
  return message
}

type Props = {
  initial?: Review | null
  /**
   * `reviews/new?type=tournament` のようなクエリによるモード切り替えを、
   * SSRとクライアント初期レンダリングで一致させるための上書き値。
   */
  tournamentMode?: boolean
}

function defaultMatches(initial: Review | null | undefined): MatchResult[] {
  if (initial) {
    const parsed = parseMatchResults(initial.matches)
    if (parsed.length > 0) return parsed
    return [getDefaultMatch()]
  }
  // 新規（スクリム・大会共通）: 試合1の入力欄を表示
  return [getDefaultMatch()]
}

/** 大会: 対戦相手1組ごとに試合をまとめる */
type TournamentGroup = {
  opponent_name: string
  matches: MatchResult[]
}

function stripMatchOpponentName(m: MatchResult): MatchResult {
  return { ...m, opponent_name: '' }
}

function tournamentGroupsToFlat(groups: TournamentGroup[]): MatchResult[] {
  return groups.flatMap((g) =>
    g.matches.map((m) => ({ ...m, opponent_name: g.opponent_name }))
  )
}

/** DB上のフラットな試合配列を、対戦相手名が変わるごとにグループ化 */
function flatMatchesToTournamentGroups(flat: MatchResult[]): TournamentGroup[] {
  if (flat.length === 0) return [{ opponent_name: '', matches: [getDefaultMatch()] }]
  const groups: TournamentGroup[] = []
  for (const m of flat) {
    const on = (m.opponent_name ?? '').trim()
    const last = groups[groups.length - 1]
    if (last && (last.opponent_name ?? '').trim() === on) {
      last.matches.push(stripMatchOpponentName(m))
    } else {
      groups.push({ opponent_name: m.opponent_name ?? '', matches: [stripMatchOpponentName(m)] })
    }
  }
  return groups
}

function initTournamentGroups(initial?: Review | null): TournamentGroup[] {
  if (!initial) return [{ opponent_name: '', matches: [getDefaultMatch()] }]
  const parsed = parseMatchResults(initial.matches)
  if (parsed.length === 0) return [{ opponent_name: '', matches: [getDefaultMatch()] }]
  return flatMatchesToTournamentGroups(parsed)
}

function globalToLocal(globalIdx: number, groups: TournamentGroup[]): { gi: number; mi: number } | null {
  let rem = globalIdx
  for (let gi = 0; gi < groups.length; gi++) {
    const len = groups[gi].matches.length
    if (rem < len) return { gi, mi: rem }
    rem -= len
  }
  return null
}

function localToGlobal(gi: number, mi: number, groups: TournamentGroup[]): number {
  let idx = 0
  for (let g = 0; g < gi; g++) idx += groups[g].matches.length
  return idx + mi
}

/** パースに失敗した場合の元の matches 文字列を保持（保存時に空で上書きしないため） */
function getInitialMatchesRef(initial?: Review | null): string | null {
  if (!initial?.matches?.trim()) return null
  const parsed = parseMatchResults(initial.matches)
  if (parsed.length > 0) return null
  return initial.matches
}

/** 簡易MDをHTMLに（既にHTMLの場合はそのまま） */
function contentToHtml(raw: string): string {
  const s = raw?.trim() ?? ''
  if (!s) return ''
  if (s.includes('<') && s.includes('>')) return s
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\n/g, '<br>')
}

export default function ReviewForm({ initial, tournamentMode }: Props) {
  const router = useRouter()
  // `reviews/new` 側で `tournamentMode` を確定して渡すため、ここでは `useSearchParams` を使わない。
  // SSR/CSR差分による Hydration mismatch を避ける。
  const isTournamentNew = typeof tournamentMode === 'boolean' ? tournamentMode : false
  const isTournamentExisting = initial?.record_type === 'tournament'
  const isTournamentMode = isTournamentNew || isTournamentExisting
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[]>(() =>
    isTournamentMode ? [] : defaultMatches(initial)
  )
  const [tournamentGroups, setTournamentGroups] = useState<TournamentGroup[]>(() =>
    isTournamentMode ? initTournamentGroups(initial ?? undefined) : []
  )

  const displayFlatMatches = useMemo(() => {
    if (!isTournamentMode) return matchResults
    return tournamentGroupsToFlat(tournamentGroups)
  }, [isTournamentMode, matchResults, tournamentGroups])

  const [form, setForm] = useState({
    review_date: initial?.review_date ?? '',
    opponent: initial?.opponent ?? '',
    content: initial?.content ?? '',
  })
  /** 大会のみ（DB の result_summary） */
  const [resultSummary, setResultSummary] = useState(() => (initial?.result_summary ?? '').trim())
  const [videos, setVideos] = useState<VideoEntry[]>(() => parseVideoUrl(initial?.video_url))

  /** スクリム: 試合を1つ追加。大会: 最後の対戦相手グループに試合を1つ追加 */
  const addMatch = () => {
    if (!isTournamentMode) {
      setMatchResults((m) => [...m, getDefaultMatch()])
      return
    }
    setTournamentGroups((gs) => {
      if (gs.length === 0) return [{ opponent_name: '', matches: [getDefaultMatch()] }]
      const next = gs.map((g) => ({ ...g, matches: g.matches.map((m) => ({ ...m })) }))
      const lastG = next[next.length - 1]
      lastG.matches.push(getDefaultMatch())
      return next
    })
  }

  /** 大会: 新しい対戦相手欄＋その下に試合1件分のブロックを追加 */
  const addOpponentAndMatch = () => {
    setTournamentGroups((gs) => [...gs, { opponent_name: '', matches: [getDefaultMatch()] }])
  }

  const updateGroupOpponent = (gi: number, v: string) => {
    setTournamentGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, opponent_name: v } : g)))
  }

  const removeMatch = (index: number) => {
    if (!isTournamentMode) {
      setMatchResults((m) => m.filter((_, i) => i !== index))
      setCollapsedAnalysisIndices((prev) => {
        const next = new Set<number>()
        prev.forEach((i) => {
          if (i < index) next.add(i)
          else if (i > index) next.add(i - 1)
        })
        return next
      })
      return
    }
    setTournamentGroups((gs) => {
      const loc = globalToLocal(index, gs)
      if (!loc) return gs
      const next = gs.map((g) => ({ ...g, matches: [...g.matches] }))
      next[loc.gi].matches.splice(loc.mi, 1)
      if (next[loc.gi].matches.length === 0) next.splice(loc.gi, 1)
      if (next.length === 0) return [{ opponent_name: '', matches: [getDefaultMatch()] }]
      return next
    })
    setCollapsedAnalysisIndices((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => {
        if (i < index) next.add(i)
        else if (i > index) next.add(i - 1)
      })
      return next
    })
  }

  const updateMatch = (index: number, field: keyof MatchResult, value: string | boolean | MemberJobPair[] | string[]) => {
    if (!isTournamentMode) {
      setMatchResults((m) => m.map((x, i) => (i === index ? { ...x, [field]: value } : x)))
      return
    }
    setTournamentGroups((gs) => {
      const loc = globalToLocal(index, gs)
      if (!loc) return gs
      const next = gs.map((g) => ({ ...g, matches: g.matches.map((x) => ({ ...x })) }))
      next[loc.gi].matches[loc.mi] = { ...next[loc.gi].matches[loc.mi], [field]: value }
      return next
    })
  }

  const updateMatchOpponentJob = (matchIndex: number, slotIndex: number, value: string) => {
    if (!isTournamentMode) {
      setMatchResults((m) =>
        m.map((x, i) =>
          i === matchIndex
            ? { ...x, opponent_jobs: x.opponent_jobs.map((v, si) => (si === slotIndex ? value : v)) }
            : x
        )
      )
      return
    }
    setTournamentGroups((gs) => {
      const loc = globalToLocal(matchIndex, gs)
      if (!loc) return gs
      const next = gs.map((g) => ({ ...g, matches: g.matches.map((x) => ({ ...x })) }))
      const row = next[loc.gi].matches[loc.mi]
      next[loc.gi].matches[loc.mi] = {
        ...row,
        opponent_jobs: row.opponent_jobs.map((v, si) => (si === slotIndex ? value : v)),
      }
      return next
    })
  }

  const updateMatchPair = (matchIndex: number, pairIndex: number, field: 'member' | 'job', value: string) => {
    if (!isTournamentMode) {
      setMatchResults((m) =>
        m.map((x, i) =>
          i === matchIndex
            ? {
                ...x,
                member_jobs: x.member_jobs.map((p, pi) =>
                  pi === pairIndex ? { ...p, [field]: value } : p
                ),
              }
            : x
        )
      )
      return
    }
    setTournamentGroups((gs) => {
      const loc = globalToLocal(matchIndex, gs)
      if (!loc) return gs
      const next = gs.map((g) => ({ ...g, matches: g.matches.map((x) => ({ ...x })) }))
      const row = next[loc.gi].matches[loc.mi]
      next[loc.gi].matches[loc.mi] = {
        ...row,
        member_jobs: row.member_jobs.map((p, pi) =>
          pi === pairIndex ? { ...p, [field]: value } : p
        ),
      }
      return next
    })
  }

  const contentRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const saveAndGoBackRef = useRef(false)
  const memberDropdownRef = useRef<HTMLDivElement>(null)
  const opponentListRef = useRef<HTMLDivElement>(null)
  const preserveMatchesRef = useRef<string | null>(getInitialMatchesRef(initial))
  /** 振り返り欄の「未編集時の innerHTML」（ブラウザ正規化後）と比較するための基準 */
  const contentBaselineRef = useRef<string | null>(null)
  const [contentFormatActive, setContentFormatActive] = useState({ bold: false, underline: false, strikeThrough: false })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [memberDropdownOpen, setMemberDropdownOpen] = useState<{ match: number; pair: number } | null>(null)
  const [pastOpponents, setPastOpponents] = useState<string[]>([])
  const [showOpponentList, setShowOpponentList] = useState(false)
  const [editingVideoUrlIndex, setEditingVideoUrlIndex] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!contentRef.current) return
    contentRef.current.innerHTML = contentToHtml(initial?.content ?? form.content)
    contentBaselineRef.current = contentRef.current.innerHTML
  }, [initial?.id])

  useEffect(() => {
    if (memberDropdownOpen === null) return
    const handleClickOutside = (e: MouseEvent) => {
      if (memberDropdownRef.current?.contains(e.target as Node)) return
      setMemberDropdownOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [memberDropdownOpen])

  useEffect(() => {
    if (!showOpponentList) return
    const handleClickOutside = (e: MouseEvent) => {
      if (opponentListRef.current?.contains(e.target as Node)) return
      setShowOpponentList(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOpponentList])

  const syncContentFromDiv = () => {
    if (contentRef.current) setForm((f) => ({ ...f, content: contentRef.current!.innerHTML }))
  }

  const updateContentFormatState = () => {
    try {
      setContentFormatActive({
        bold: document.queryCommandState('bold'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
      })
    } catch {
      // ignore
    }
  }

  const execContentCommand = (command: string, value?: string) => {
    contentRef.current?.focus()
    document.execCommand(command, false, value)
    syncContentFromDiv()
    setTimeout(updateContentFormatState, 0)
  }

  const copyPreviousMatchTo = (matchIndex: number) => {
    if (matchIndex <= 0) return
    const prev = displayFlatMatches[matchIndex - 1]
    updateMatch(
      matchIndex,
      'member_jobs',
      prev.member_jobs.map((p) => ({ ...p }))
    )
    updateMatch(matchIndex, 'opponent_jobs', [...prev.opponent_jobs])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (isTournamentMode && !initial?.id) {
      if (!form.opponent.trim()) {
        setError('大会名を入力してください')
        setLoading(false)
        return
      }
    }
    const contentHtml = contentRef.current?.innerHTML
    const matches =
      initial?.id && displayFlatMatches.length === 0 && preserveMatchesRef.current
        ? preserveMatchesRef.current
        : serializeMatchResults(displayFlatMatches)
    // 編集中に contentRef が未反映で空になる場合、既存の振り返りを空で上書きしない
    const rawContent = contentHtml !== undefined ? contentHtml : form.content
    const hasExistingContent = (initial?.content ?? '').trim() !== ''
    const contentToSave =
      initial?.id && (rawContent ?? '').trim() === '' && hasExistingContent
        ? (initial.content ?? '')
        : (rawContent ?? '')
    const payload: Record<string, unknown> = {
      ...form,
      content: contentToSave,
      members: '',
      jobs: '',
      matches,
      video_url: serializeVideos(videos),
    }
    if (initial?.id) {
      payload.record_type = initial.record_type ?? 'scrim'
    } else {
      payload.record_type = isTournamentNew ? 'tournament' : 'scrim'
    }
    payload.result_summary = isTournamentMode ? (resultSummary.trim() || null) : null

    const supabase = createClient()
    if (initial?.id) {
      const { error: err } = await supabase.from('reviews').update(payload).eq('id', initial.id)
      if (err) {
        setError(formatSupabaseSaveError(err.message))
        setLoading(false)
        return
      }
      setLoading(false)
      router.refresh()
      if (saveAndGoBackRef.current) {
        saveAndGoBackRef.current = false
        router.back()
      }
    } else {
      const { data: inserted, error: err } = await supabase.from('reviews').insert(payload).select('id').single()
      if (err) {
        setError(formatSupabaseSaveError(err.message))
        setLoading(false)
        return
      }
      setLoading(false)
      if (inserted?.id) {
        router.refresh()
        if (saveAndGoBackRef.current) {
          saveAndGoBackRef.current = false
          router.push('/')
        } else {
          router.replace(`/reviews/${inserted.id}/edit`)
        }
      }
    }
  }

  const hasUnsavedChanges = (): boolean => {
    const currentMatches = serializeMatchResults(displayFlatMatches)
    const currentVideos = serializeVideos(videos)
    const currentContent = (contentRef.current?.innerHTML ?? '').trim()
    if (initial) {
      // DB の生文字列ではなく、パース→シリアライズで正規化して比較（JSON の空白差などで誤検知しない）
      const baselineMatches = serializeMatchResults(parseMatchResults(initial.matches))
      if (currentMatches !== baselineMatches) return true
      const baselineVideos = serializeVideos(parseVideoUrl(initial.video_url))
      if (currentVideos !== baselineVideos) return true
      if ((form.review_date ?? '') !== (initial.review_date ?? '')) return true
      if ((form.opponent ?? '') !== (initial.opponent ?? '')) return true
      // 振り返り: DB の文字列と innerHTML はブラウザが異なる形に正規化するため、読み込み直後の innerHTML を基準にする
      const baselineContent = (contentBaselineRef.current ?? '').trim()
      if (currentContent !== baselineContent) return true
      if (isTournamentMode && resultSummary.trim() !== (initial.result_summary ?? '').trim()) return true
      return false
    }
    const defaultMatchesStr = serializeMatchResults(
      isTournamentMode ? tournamentGroupsToFlat(initTournamentGroups(null)) : [getDefaultMatch()]
    )
    if (currentMatches !== defaultMatchesStr) return true
    if (currentVideos !== '[]') return true
    if ((form.review_date ?? '').trim()) return true
    if ((form.opponent ?? '').trim()) return true
    if (currentContent) return true
    if (isTournamentMode && resultSummary.trim()) return true
    return false
  }

  const renderMatchCard = (match: MatchResult, matchIndex: number, cardKey: string | number) => {
    const isColoredMatch = match.result === '勝ち' || match.result === '負け'
    const labelClass = isColoredMatch ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'
    const headingClass = isColoredMatch ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'
    const mutedClass = isColoredMatch ? 'text-white' : 'text-zinc-700 dark:text-zinc-300'

    return (
      <div
        key={cardKey}
        className={`rounded-lg border p-4 backdrop-blur-sm ${
          match.result === '勝ち'
            ? 'border-[#8a4526]/90 bg-[#a0522d]/82 dark:border-[#6d3820]/90 dark:bg-[#a0522d]/82'
            : match.result === '負け'
              ? 'border-[#3a6d99]/90 bg-[#4682b4]/82 dark:border-[#3a6d99]/90 dark:bg-[#4682b4]/82'
              : 'border-zinc-200/90 bg-white/72 dark:border-zinc-600/90 dark:bg-zinc-900/68'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className={`text-sm font-medium ${headingClass}`}>試合 {matchIndex + 1}</span>
          <div className="flex gap-2">
            {matchIndex > 0 && (
              <button
                type="button"
                onClick={() => copyPreviousMatchTo(matchIndex)}
                className={`rounded border px-2 py-1 text-xs ${isColoredMatch ? 'border-white bg-zinc-600/60 text-white hover:bg-zinc-600/80 dark:border-white dark:bg-zinc-600/60 dark:hover:bg-zinc-600/80' : 'border-zinc-300 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600'}`}
              >
                前の試合を引き継ぐ
              </button>
            )}
            <button
              type="button"
              onClick={() => removeMatch(matchIndex)}
              className={`text-sm ${isColoredMatch ? 'text-white hover:opacity-90' : 'text-zinc-500 hover:text-red-600 dark:hover:text-red-400'}`}
              aria-label="この試合を削除"
            >
              削除
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <span className={`mb-1.5 block text-xs font-medium ${labelClass}`}>メンバー・ジョブ</span>
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-800/30 dark:bg-zinc-800/80">
              {(match.member_jobs.length > 0 ? match.member_jobs : Array.from({ length: DEFAULT_MEMBER_ROWS }, () => ({ member: '', job: '' }))).slice(0, DEFAULT_MEMBER_ROWS).map((pair, pairIndex) => {
                const isCustomMember = pair.member && !MEMBERS_LIST.includes(pair.member as (typeof MEMBERS_LIST)[number])
                const selectValue = isCustomMember ? CUSTOM_MEMBER_VALUE : (pair.member || '')
                return (
                  <div key={pairIndex} className="flex w-full flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 basis-0 items-center gap-1.5">
                      {selectValue === CUSTOM_MEMBER_VALUE ? (
                        <div
                          ref={memberDropdownOpen?.match === matchIndex && memberDropdownOpen?.pair === pairIndex ? memberDropdownRef : undefined}
                          className="relative flex min-w-0 flex-1 basis-0 items-center rounded-lg border border-zinc-300/90 bg-white/65 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-900/50"
                        >
                          <input
                            type="text"
                            placeholder="名前を直接入力"
                            value={pair.member === ' ' ? '' : pair.member}
                            onChange={(e) => updateMatchPair(matchIndex, pairIndex, 'member', e.target.value || ' ')}
                            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                            aria-label={`試合${matchIndex + 1} ${pairIndex + 1}行目: メンバー（直接入力）`}
                          />
                          <button
                            type="button"
                            onClick={() => setMemberDropdownOpen((prev) => (prev?.match === matchIndex && prev?.pair === pairIndex ? null : { match: matchIndex, pair: pairIndex }))}
                            className="flex shrink-0 items-center justify-center rounded-r-md py-1.5 pr-2 text-zinc-500 dark:text-zinc-400"
                            aria-label="リストを開く"
                          >
                            <span className="text-xs" aria-hidden>▼</span>
                          </button>
                          {memberDropdownOpen?.match === matchIndex && memberDropdownOpen?.pair === pairIndex && (
                            <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-48 overflow-auto rounded-lg border border-zinc-300/90 bg-white/92 py-1 shadow-lg backdrop-blur-md dark:border-zinc-600/90 dark:bg-zinc-900/90">
                              <li>
                                <button
                                  type="button"
                                  className="w-full px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                  onClick={() => { updateMatchPair(matchIndex, pairIndex, 'member', ''); setMemberDropdownOpen(null) }}
                                >
                                  選択してください
                                </button>
                              </li>
                              {MEMBERS_LIST.map((m) => (
                                <li key={m}>
                                  <button
                                    type="button"
                                    className="w-full px-2 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
                                    onClick={() => { updateMatchPair(matchIndex, pairIndex, 'member', m); setMemberDropdownOpen(null) }}
                                  >
                                    {m}
                                  </button>
                                </li>
                              ))}
                              <li>
                                <button
                                  type="button"
                                  className="w-full px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                  onClick={() => setMemberDropdownOpen(null)}
                                >
                                  その他（直接入力）
                                </button>
                              </li>
                            </ul>
                          )}
                        </div>
                      ) : (
                        <select
                          value={selectValue}
                          onChange={(e) => {
                            const v = e.target.value
                            updateMatchPair(matchIndex, pairIndex, 'member', v === CUSTOM_MEMBER_VALUE ? ' ' : v)
                          }}
                          className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-1.5 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                          aria-label={`試合${matchIndex + 1} ${pairIndex + 1}行目: メンバー`}
                        >
                          <option value="">選択してください</option>
                          {MEMBERS_LIST.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value={CUSTOM_MEMBER_VALUE}>その他（直接入力）</option>
                        </select>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 basis-0">
                      <select
                        value={pair.job}
                        onChange={(e) => updateMatchPair(matchIndex, pairIndex, 'job', e.target.value)}
                        className={`w-full rounded-lg border px-2 py-1.5 text-sm ${pair.job ? 'pl-8' : ''} ${getJobCategoryClass(pair.job) || 'border-zinc-300/90 bg-white/55 text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100'}`}
                        aria-label={`試合${matchIndex + 1} ${pairIndex + 1}行目: ジョブ`}
                        style={pair.job ? { backgroundImage: `url(${getJobIconPath(pair.job)})`, backgroundRepeat: 'no-repeat', backgroundPosition: '6px center', backgroundSize: '20px 20px' } : undefined}
                      >
                        <option value="">選択してください</option>
                        {JOBS_LIST.map((j) => (
                          <option key={j} value={j}>{j}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="min-w-0 shrink-0 sm:w-52">
            <label className={`mb-1.5 block text-xs font-medium ${labelClass}`}>相手チームのジョブ</label>
            <div className="space-y-2 rounded border border-violet-200 bg-violet-50/50 p-2 dark:border-violet-800/30 dark:bg-zinc-800/80">
              {[0, 1, 2, 3, 4].map((slotIndex) => {
                const job = match.opponent_jobs[slotIndex] ?? ''
                return (
                  <div key={slotIndex}>
                    <select
                      value={job}
                      onChange={(e) => updateMatchOpponentJob(matchIndex, slotIndex, e.target.value)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-sm ${job ? 'pl-8' : ''} ${getJobCategoryClass(job) || 'border-zinc-300/90 bg-white/55 text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100'}`}
                      aria-label={`相手${slotIndex + 1}人目 ジョブ`}
                      style={job ? { backgroundImage: `url(${getJobIconPath(job)})`, backgroundRepeat: 'no-repeat', backgroundPosition: '6px center', backgroundSize: '20px 20px' } : undefined}
                    >
                      <option value="">選択</option>
                      {JOBS_LIST.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label className={`mb-0.5 block text-xs font-medium ${labelClass}`}>マップ</label>
              <select
                value={match.map}
                onChange={(e) => updateMatch(matchIndex, 'map', e.target.value)}
                className="w-full max-w-xs rounded-lg border border-zinc-300/90 bg-white/55 px-3 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
              >
                <option value="">選択してください</option>
                {MAPS_LIST.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="w-24 shrink-0">
                <label className={`mb-0.5 block text-xs font-medium ${labelClass}`}>勝ち負け</label>
                <select
                  value={match.result}
                  onChange={(e) => updateMatch(matchIndex, 'result', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                >
                  <option value="">選択</option>
                  {RESULT_LIST.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="w-28 shrink-0">
                <label className={`mb-0.5 block text-xs font-medium ${labelClass}`}>OT突入時状況</label>
                <select
                  value={match.ot_situation}
                  onChange={(e) => updateMatch(matchIndex, 'ot_situation', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                >
                  <option value="">選択</option>
                  {OT_SITUATION_LIST.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className={`mb-0.5 block text-xs font-medium ${labelClass}`}>残り 分</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="分"
                    value={match.end_minutes}
                    onChange={(e) => updateMatch(matchIndex, 'end_minutes', e.target.value)}
                    className="w-14 rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className={`mb-0.5 block text-xs font-medium ${labelClass}`}>秒</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="秒"
                    value={match.end_seconds}
                    onChange={(e) => updateMatch(matchIndex, 'end_seconds', e.target.value)}
                    className="w-14 rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                  />
                </div>
                <label className="flex items-center gap-1.5 pb-2">
                  <input
                    type="checkbox"
                    checked={match.is_ot}
                    onChange={(e) => updateMatch(matchIndex, 'is_ot', e.target.checked)}
                    className="rounded border-zinc-300/90 bg-white/50 text-zinc-900 dark:border-zinc-600/90 dark:bg-zinc-900/40"
                  />
                  <span className={`text-sm ${mutedClass}`}>OT</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[12rem] shrink-0 max-w-full sm:w-[13rem]">
                <label className={`mb-0.5 block text-xs font-medium leading-snug ${labelClass}`}>
                  クリスタル状況：OT前50%（自）
                </label>
                <select
                  value={isCrystalPreOtHalfValue(match.crystal_self) ? match.crystal_self : ''}
                  onChange={(e) => updateMatch(matchIndex, 'crystal_self', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                >
                  <option value="">選択</option>
                  {CRYSTAL_PRE_OT_HALF_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-[12rem] shrink-0 max-w-full sm:w-[13rem]">
                <label className={`mb-0.5 block text-xs font-medium leading-snug ${labelClass}`}>
                  クリスタル状況：OT前50%（相手）
                </label>
                <select
                  value={isCrystalPreOtHalfValue(match.crystal_opponent) ? match.crystal_opponent : ''}
                  onChange={(e) => updateMatch(matchIndex, 'crystal_opponent', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                >
                  <option value="">選択</option>
                  {CRYSTAL_PRE_OT_HALF_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <label
              htmlFor={`match-analysis-${cardKey}`}
              className={`mb-1.5 shrink-0 block text-xs font-medium ${labelClass}`}
            >
              各試合分析
            </label>
            <textarea
              id={`match-analysis-${cardKey}`}
              value={match.analysis ?? ''}
              onChange={(e) => updateMatch(matchIndex, 'analysis', e.target.value)}
              placeholder="この試合の分析を入力"
              rows={1}
              className="min-h-[8rem] w-full resize-y rounded-lg border border-zinc-300/90 bg-white/60 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-900/45 dark:text-zinc-100 dark:placeholder:text-zinc-500 lg:min-h-0 lg:flex-1 lg:self-stretch"
            />
          </div>
        </div>
      </div>
    )
  }

  const handleBackClick = () => {
    if (hasUnsavedChanges()) setShowLeaveConfirm(true)
    else router.back()
  }
  const handleSaveAndBack = () => {
    saveAndGoBackRef.current = true
    setShowLeaveConfirm(false)
    formRef.current?.requestSubmit()
  }
  const handleLeaveWithoutSave = () => {
    setShowLeaveConfirm(false)
    router.back()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleBackClick}
        className="mb-4 inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← 一覧へ戻る
      </button>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="review_date" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          日付
        </label>
        <div className="flex items-stretch rounded-lg border border-zinc-300/90 dark:border-zinc-600/90">
          <button
            type="button"
            onClick={() => (document.getElementById('review_date') as HTMLInputElement)?.showPicker?.()}
            className="flex shrink-0 items-center justify-center rounded-l-lg border-r border-zinc-300/90 bg-zinc-100/80 px-3 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/50"
            aria-label="カレンダーを開く"
            title="カレンダーを開く"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-400">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </button>
          <input
            id="review_date"
            type="date"
            required
            value={form.review_date}
            onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))}
            className="min-w-0 flex-1 rounded-r-lg border-0 bg-white/55 px-3 py-2 text-zinc-900 backdrop-blur-sm dark:bg-zinc-900/45 dark:text-zinc-100"
          />
        </div>
      </div>
      {/* 日付の直下: 大会は「大会名」、スクリムは「対戦相手」（スクリムは従来どおり） */}
      {isTournamentMode ? (
        <div>
          <label htmlFor="tournament_name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            大会名
          </label>
          <input
            id="tournament_name"
            type="text"
            value={form.opponent}
            onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
            className="w-full rounded-lg border border-zinc-300/90 bg-white/65 px-3 py-2 text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/50 dark:text-zinc-100"
            placeholder="例: 〇〇大会"
            required
          />
        </div>
      ) : (
        <div ref={opponentListRef} className="relative">
          <label htmlFor="opponent" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            対戦相手
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="opponent"
              type="text"
              value={form.opponent}
              onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300/90 bg-white/65 px-3 py-2 text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/50 dark:text-zinc-100"
              placeholder="例: 〇〇チーム"
            />
            <button
              type="button"
              onClick={async () => {
                if (showOpponentList) {
                  setShowOpponentList(false)
                  return
                }
                try {
                  const res = await fetch('/api/opponents')
                  if (res.ok) {
                    const names = (await res.json()) as string[]
                    setPastOpponents(names)
                    setShowOpponentList(true)
                  }
                } catch {
                  setPastOpponents([])
                  setShowOpponentList(true)
                }
              }}
              className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              対戦歴から選ぶ
            </button>
          </div>
          {showOpponentList && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-300/90 bg-white/92 py-1 shadow-lg backdrop-blur-md dark:border-zinc-600/90 dark:bg-zinc-900/90">
              {pastOpponents.length === 0 ? (
                <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">対戦歴がありません</li>
              ) : (
                pastOpponents.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      onClick={() => {
                        setForm((f) => ({ ...f, opponent: name }))
                        setShowOpponentList(false)
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      <div>
        <div className="mb-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            試合ごとの結果
          </span>
        </div>
        <div
          className={
            isTournamentMode
              ? 'space-y-6'
              : 'space-y-4 rounded-lg border border-zinc-200/90 bg-zinc-50/70 p-3 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-800/55'
          }
        >
          {isTournamentMode
            ? tournamentGroups.map((group, gi) => (
                <div
                  key={gi}
                  className="rounded-xl border-2 border-zinc-300/90 bg-zinc-50/75 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-900/65 dark:shadow-none"
                >
                  <div className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
                    <label
                      htmlFor={`tournament_group_opponent_${gi}`}
                      className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-100"
                    >
                      対戦相手 {gi + 1}
                    </label>
                    <input
                      id={`tournament_group_opponent_${gi}`}
                      type="text"
                      value={group.opponent_name}
                      onChange={(e) => updateGroupOpponent(gi, e.target.value)}
                      placeholder="例: 〇〇チーム"
                      className="w-full rounded-lg border border-zinc-300/90 bg-white/70 px-3 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/50 dark:text-zinc-100"
                      aria-label={`対戦相手 ${gi + 1}`}
                    />
                  </div>
                  <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    {group.matches.map((match, mi) => {
                      const matchIndex = localToGlobal(gi, mi, tournamentGroups)
                      return renderMatchCard(match, matchIndex, `${gi}-${mi}`)
                    })}
                  </div>
                </div>
              ))
            : matchResults.map((match, matchIndex) => renderMatchCard(match, matchIndex, matchIndex))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={addMatch}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + 試合を追加
            </button>
          </div>
          {isTournamentMode && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={addOpponentAndMatch}
                className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
              >
                + 対戦相手を追加
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="content" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          全体振り返り
        </label>
        <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-zinc-300/90 bg-zinc-100/75 p-1 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45">
          <button
            type="button"
            onClick={() => execContentCommand('bold')}
            className={`rounded px-2 py-1 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 ${contentFormatActive.bold ? 'bg-blue-200 text-blue-900 dark:bg-blue-700 dark:text-blue-100' : 'text-zinc-700 dark:text-zinc-300'}`}
            title="太字"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => execContentCommand('underline')}
            className={`rounded px-2 py-1 text-sm underline hover:bg-zinc-200 dark:hover:bg-zinc-700 ${contentFormatActive.underline ? 'bg-blue-200 text-blue-900 dark:bg-blue-700 dark:text-blue-100' : 'text-zinc-700 dark:text-zinc-300'}`}
            title="アンダーライン"
          >
            U
          </button>
          <button
            type="button"
            onClick={() => execContentCommand('strikeThrough')}
            className={`rounded px-2 py-1 text-sm line-through hover:bg-zinc-200 dark:hover:bg-zinc-700 ${contentFormatActive.strikeThrough ? 'bg-blue-200 text-blue-900 dark:bg-blue-700 dark:text-blue-100' : 'text-zinc-700 dark:text-zinc-300'}`}
            title="取り消し線"
          >
            S
          </button>
        </div>
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="全体振り返り"
          data-placeholder="反省・気づきを記入"
          onInput={syncContentFromDiv}
          onSelect={updateContentFormatState}
          onKeyUp={updateContentFormatState}
          onMouseUp={updateContentFormatState}
          className="min-h-[100px] w-full rounded-b-lg rounded-t-none border border-zinc-300/90 bg-white/60 px-3 py-2 text-zinc-900 backdrop-blur-sm empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 dark:border-zinc-600/90 dark:bg-zinc-900/45 dark:text-zinc-100 dark:empty:before:text-zinc-500"
          style={{ outline: 'none' }}
        />
      </div>
      <div>
        <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          動画URL
        </div>
        <div className="space-y-3">
          {videos.map((video, index) => (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30"
            >
              <div className="min-w-0 flex-1 basis-0">
                <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">URL</label>
                {video.url.trim() && editingVideoUrlIndex !== index ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={video.url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {video.url.trim()}
                    </a>
                    <button
                      type="button"
                      onClick={() => setEditingVideoUrlIndex(index)}
                      className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
                    >
                      変更
                    </button>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={video.url}
                    onChange={(e) =>
                      setVideos((v) => v.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)))
                    }
                    onBlur={() => setEditingVideoUrlIndex(null)}
                    className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-3 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                    placeholder="https://..."
                  />
                )}
              </div>
              <div className="w-32 shrink-0">
                <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">視点</label>
                <select
                  value={video.viewpoint}
                  onChange={(e) =>
                    setVideos((v) => v.map((x, i) => (i === index ? { ...x, viewpoint: e.target.value } : x)))
                  }
                  className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                >
                  <option value="">選択</option>
                  {video.viewpoint && !MEMBERS_LIST.includes(video.viewpoint as (typeof MEMBERS_LIST)[number]) && (
                    <option value={video.viewpoint}>{video.viewpoint}</option>
                  )}
                  {MEMBERS_LIST.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="w-80 shrink-0 sm:w-96">
                <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">タイトル</label>
                <input
                  type="text"
                  value={video.title}
                  onChange={(e) =>
                    setVideos((v) => v.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))
                  }
                  className="w-full rounded-lg border border-zinc-300/90 bg-white/55 px-2 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/45 dark:text-zinc-100"
                  placeholder="動画のタイトル"
                />
              </div>
              <button
                type="button"
                onClick={() => setVideos((v) => v.filter((_, i) => i !== index))}
                className="rounded border border-zinc-300 px-2 py-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVideos((v) => [...v, { url: '', viewpoint: '', title: '' }])}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + 動画を追加
          </button>
        </div>
      </div>

      {isTournamentMode && (
        <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/75 p-4 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-900/60">
          <label
            htmlFor="result_summary"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            大会結果
          </label>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            順位・総合成績など（例: 優勝、3位）
          </p>
          <input
            id="result_summary"
            type="text"
            value={resultSummary}
            onChange={(e) => setResultSummary(e.target.value)}
            placeholder="例: 準優勝 / 5位タイ など"
            className="w-full max-w-xl rounded-lg border border-zinc-300/90 bg-white/70 px-3 py-2 text-sm text-zinc-900 backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-800/50 dark:text-zinc-100"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? '保存中...' : initial?.id ? '更新' : '登録'}
        </button>
        <button
          type="button"
          onClick={handleBackClick}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          一覧に戻る
        </button>
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <p id="leave-confirm-title" className="mb-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              保存せずに一覧に戻ろうとしています。保存しますか？
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveAndBack}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                保存して
                <br />
                戻る
              </button>
              <button
                type="button"
                onClick={handleLeaveWithoutSave}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                保存せずに
                <br />
                戻る
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
    </form>
    </>
  )
}
