'use client'

import { useState, useRef, useEffect } from 'react'
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

type Props = {
  initial?: Review | null
}

function defaultMatches(initial?: Review | null): MatchResult[] {
  const parsed = parseMatchResults(initial?.matches)
  if (parsed.length > 0) return parsed
  return [getDefaultMatch()]
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

export default function ReviewForm({ initial }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[]>(() => defaultMatches(initial))
  const [form, setForm] = useState({
    review_date: initial?.review_date ?? '',
    opponent: initial?.opponent ?? '',
    content: initial?.content ?? '',
  })
  const [videos, setVideos] = useState<VideoEntry[]>(() => parseVideoUrl(initial?.video_url))

  const addMatch = () => setMatchResults((m) => [...m, getDefaultMatch()])
  const removeMatch = (index: number) => setMatchResults((m) => m.filter((_, i) => i !== index))
  const updateMatch = (index: number, field: keyof MatchResult, value: string | boolean | MemberJobPair[] | string[]) => {
    setMatchResults((m) => m.map((x, i) => (i === index ? { ...x, [field]: value } : x)))
  }

  const updateMatchOpponentJob = (matchIndex: number, slotIndex: number, value: string) => {
    setMatchResults((m) =>
      m.map((x, i) =>
        i === matchIndex
          ? { ...x, opponent_jobs: x.opponent_jobs.map((v, si) => (si === slotIndex ? value : v)) }
          : x
      )
    )
  }

  const updateMatchPair = (matchIndex: number, pairIndex: number, field: 'member' | 'job', value: string) => {
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
  }

  const contentRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const saveAndGoBackRef = useRef(false)
  const memberDropdownRef = useRef<HTMLDivElement>(null)
  const preserveMatchesRef = useRef<string | null>(getInitialMatchesRef(initial))
  const [contentFormatActive, setContentFormatActive] = useState({ bold: false, underline: false, strikeThrough: false })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [memberDropdownOpen, setMemberDropdownOpen] = useState<{ match: number; pair: number } | null>(null)

  useEffect(() => {
    if (!contentRef.current) return
    contentRef.current.innerHTML = contentToHtml(initial?.content ?? form.content)
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
    const prev = matchResults[matchIndex - 1]
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
    const contentHtml = contentRef.current?.innerHTML
    const matches =
      initial?.id && matchResults.length === 0 && preserveMatchesRef.current
        ? preserveMatchesRef.current
        : serializeMatchResults(matchResults)
    const payload = {
      ...form,
      content: contentHtml !== undefined ? contentHtml : form.content,
      members: '',
      jobs: '',
      matches,
      video_url: serializeVideos(videos),
    }
    const supabase = createClient()
    if (initial?.id) {
      const { error: err } = await supabase.from('reviews').update(payload).eq('id', initial.id)
      if (err) {
        setError(err.message)
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
        setError(err.message)
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
    const currentMatches = serializeMatchResults(matchResults)
    const currentVideos = serializeVideos(videos)
    const currentContent = (contentRef.current?.innerHTML ?? form.content ?? '').trim()
    if (initial) {
      if (currentMatches !== (initial.matches ?? '[]')) return true
      if (currentVideos !== (initial.video_url ?? '')) return true
      if ((form.review_date ?? '') !== (initial.review_date ?? '')) return true
      if ((form.opponent ?? '') !== (initial.opponent ?? '')) return true
      if (currentContent !== (initial.content ?? '').trim()) return true
      return false
    }
    const defaultMatchesStr = serializeMatchResults([getDefaultMatch()])
    if (currentMatches !== defaultMatchesStr) return true
    if (currentVideos !== '[]') return true
    if ((form.review_date ?? '').trim()) return true
    if ((form.opponent ?? '').trim()) return true
    if (currentContent) return true
    return false
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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="review_date" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          日付
        </label>
        <div className="flex items-stretch rounded-lg border border-zinc-300 dark:border-zinc-600">
          <button
            type="button"
            onClick={() => (document.getElementById('review_date') as HTMLInputElement)?.showPicker?.()}
            className="flex shrink-0 items-center justify-center rounded-l-lg border-r border-zinc-300 bg-zinc-100 px-3 dark:border-zinc-600 dark:bg-zinc-800"
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
            className="min-w-0 flex-1 rounded-r-lg border-0 px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>
      <div>
        <label htmlFor="opponent" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          対戦相手
        </label>
        <input
          id="opponent"
          type="text"
          value={form.opponent}
          onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="例: 〇〇チーム"
        />
      </div>

      <div>
        <div className="mb-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            試合ごとの結果
          </span>
        </div>
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
          {matchResults.map((match, matchIndex) => (
            <div
              key={matchIndex}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">試合 {matchIndex + 1}</span>
                <div className="flex gap-2">
                  {matchIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => copyPreviousMatchTo(matchIndex)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      前の試合を引き継ぐ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMatch(matchIndex)}
                    className="text-sm text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="この試合を削除"
                  >
                    削除
                  </button>
                </div>
              </div>

              {/* 自チーム メンバー・ジョブ と 相手チームのジョブ を横並び */}
              <div className="mb-3 flex flex-col gap-4 sm:flex-row">
                {/* この試合のメンバー・ジョブ（5人固定） */}
                <div className="min-w-0 flex-1">
                  <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">メンバー・ジョブ</span>
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
                                className="relative flex min-w-0 flex-1 basis-0 items-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
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
                                  <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-48 overflow-auto rounded-lg border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-800">
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
                                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                              className={`w-full rounded-lg border px-2 py-1.5 text-sm ${pair.job ? 'pl-8' : ''} ${getJobCategoryClass(pair.job) || 'border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'}`}
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

                {/* 相手チームのジョブ（5人分・別セクション） */}
                <div className="min-w-0 shrink-0 sm:w-52">
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">相手チームのジョブ</label>
                  <div className="space-y-2 rounded border border-violet-200 bg-violet-50/50 p-2 dark:border-violet-800/30 dark:bg-zinc-800/80">
                    {[0, 1, 2, 3, 4].map((slotIndex) => {
                      const job = match.opponent_jobs[slotIndex] ?? ''
                      return (
                        <div key={slotIndex}>
                          <select
                            value={job}
                            onChange={(e) => updateMatchOpponentJob(matchIndex, slotIndex, e.target.value)}
                            className={`w-full rounded-lg border px-2 py-1.5 text-sm ${job ? 'pl-8' : ''} ${getJobCategoryClass(job) || 'border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'}`}
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

              {/* マップ（1行目） */}
              <div className="mb-3">
                <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">マップ</label>
                <select
                  value={match.map}
                  onChange={(e) => updateMatch(matchIndex, 'map', e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">選択してください</option>
                  {MAPS_LIST.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 勝ち負け・OT突入時状況・残り 分秒（2行目） */}
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div className="w-24 shrink-0">
                  <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">勝ち負け</label>
                  <select
                    value={match.result}
                    onChange={(e) => updateMatch(matchIndex, 'result', e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">選択</option>
                    {RESULT_LIST.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28 shrink-0">
                  <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">OT突入時状況</label>
                  <select
                    value={match.ot_situation}
                    onChange={(e) => updateMatch(matchIndex, 'ot_situation', e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">選択</option>
                    {OT_SITUATION_LIST.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">残り 分</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="分"
                      value={match.end_minutes}
                      onChange={(e) => updateMatch(matchIndex, 'end_minutes', e.target.value)}
                      className="w-14 rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">秒</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="秒"
                      value={match.end_seconds}
                      onChange={(e) => updateMatch(matchIndex, 'end_seconds', e.target.value)}
                      className="w-14 rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 pb-2">
                    <input
                      type="checkbox"
                      checked={match.is_ot}
                      onChange={(e) => updateMatch(matchIndex, 'is_ot', e.target.checked)}
                      className="rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">OT</span>
                  </label>
                </div>
              </div>

              {/* クリスタル輸送 自・相手（3行目） */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-24 shrink-0">
                  <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">クリスタル 自</label>
                  <div className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="50"
                      value={match.crystal_self.replace(/%/g, '')}
                      onChange={(e) => {
                        const half = e.target.value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
                        const num = half.replace(/[^0-9]/g, '')
                        updateMatch(matchIndex, 'crystal_self', num ? `${num}%` : '')
                      }}
                      className="w-full rounded-l-lg border-0 px-2 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <span className="shrink-0 pr-2 text-sm text-zinc-500 dark:text-zinc-400">%</span>
                  </div>
                </div>
                <div className="w-24 shrink-0">
                  <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">クリスタル 相手</label>
                  <div className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="50"
                      value={match.crystal_opponent.replace(/%/g, '')}
                      onChange={(e) => {
                        const half = e.target.value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
                        const num = half.replace(/[^0-9]/g, '')
                        updateMatch(matchIndex, 'crystal_opponent', num ? `${num}%` : '')
                      }}
                      className="w-full rounded-l-lg border-0 px-2 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <span className="shrink-0 pr-2 text-sm text-zinc-500 dark:text-zinc-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-start">
          <button
            type="button"
            onClick={addMatch}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + 試合を追加
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="content" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          反省内容
        </label>
        <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-zinc-300 bg-zinc-100 p-1 dark:border-zinc-600 dark:bg-zinc-800/50">
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
          aria-label="反省内容"
          data-placeholder="反省・気づきを記入"
          onInput={syncContentFromDiv}
          onSelect={updateContentFormatState}
          onKeyUp={updateContentFormatState}
          onMouseUp={updateContentFormatState}
          className="min-h-[100px] w-full rounded-b-lg rounded-t-none border border-zinc-300 px-3 py-2 text-zinc-900 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:empty:before:text-zinc-500"
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
                <input
                  type="url"
                  value={video.url}
                  onChange={(e) =>
                    setVideos((v) => v.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="https://..."
                />
              </div>
              <div className="w-32 shrink-0">
                <label className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">視点</label>
                <select
                  value={video.viewpoint}
                  onChange={(e) =>
                    setVideos((v) => v.map((x, i) => (i === index ? { ...x, viewpoint: e.target.value } : x)))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                  className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
