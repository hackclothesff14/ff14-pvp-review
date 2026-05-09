import { parseMatchResults, type MatchResult } from '@/lib/constants'

/** 戦術ページの対戦チーム集計用（reviews の一部列） */
export type ReviewRowForOpponentStats = {
  id: string
  review_date: string
  record_type?: string | null
  opponent?: string | null
  matches?: string | null
}

export type OpponentMatchHit = {
  reviewId: string
  reviewDate: string
  recordType: string | null | undefined
  matchIndex: number
  map: string
  result: string
  opponentJobs: string[]
}

function isTournamentReview(r: ReviewRowForOpponentStats): boolean {
  return r.record_type === 'tournament'
}

/** チーム名は前後空白を除いた文字列同士で完全一致（部分一致・曖昧検索なし） */
function isExactTeamMatch(teamKey: string, r: ReviewRowForOpponentStats, m: MatchResult): boolean {
  if (isTournamentReview(r)) {
    return (m.opponent_name ?? '').trim() === teamKey
  }
  return (r.opponent ?? '').trim() === teamKey
}

/**
 * `teamNameRaw` を trim したキーと、レビューデータを照合して該当試合を列挙する。
 * - スクリム: `reviews.opponent` がキーと一致するレビューに含まれる全試合
 * - 大会: 各試合の `opponent_name` がキーと一致する試合のみ
 */
export function collectOpponentMatchHits(
  rows: ReviewRowForOpponentStats[],
  teamNameRaw: string
): OpponentMatchHit[] {
  const teamKey = teamNameRaw.trim()
  if (!teamKey) return []

  const hits: OpponentMatchHit[] = []
  for (const r of rows) {
    const matches = parseMatchResults(r.matches)
    matches.forEach((m, matchIndex) => {
      if (!isExactTeamMatch(teamKey, r, m)) return
      const opponentJobs = (m.opponent_jobs ?? [])
        .map((j) => (typeof j === 'string' ? j.trim() : ''))
        .filter((j) => j.length > 0)
      hits.push({
        reviewId: r.id,
        reviewDate: r.review_date,
        recordType: r.record_type,
        matchIndex,
        map: typeof m.map === 'string' ? m.map.trim() : '',
        result: typeof m.result === 'string' ? m.result.trim() : '',
        opponentJobs,
      })
    })
  }

  hits.sort((a, b) => {
    const d = b.reviewDate.localeCompare(a.reviewDate)
    if (d !== 0) return d
    return b.matchIndex - a.matchIndex
  })
  return hits
}

/** 編成（5人組み）ごとの累積集計・順序は問わずジョブ名をソートして同一視 */
export type OpponentCompositionRankingItem = {
  /** 表示用（ジョブ名を読み順でソートし ` / ` 連結。未入力は固定ラベル） */
  label: string
  count: number
  /** 全該当試合数に占める割合（%・小数1桁） */
  percent: number
  /** 当該編成が最後に出現した試合のレビュー日付（YYYY-MM-DD 想定） */
  lastSeen: string
}

export type OpponentStatsSummary = {
  teamKey: string
  totalMatches: number
  wins: number
  losses: number
  draws: number
  otherResults: number
  /** 新しい順・最大件数は呼び出し側で slice */
  recentHits: OpponentMatchHit[]
  /** 相手ジョブの出現回数（多い順） */
  jobRanking: { job: string; count: number }[]
  /** 編成パターン（出現回数多い順・割合・最終観測日） */
  compositionRanking: OpponentCompositionRankingItem[]
  /** 直近試合の編成（新しい順・最大5） */
  recentCompositions: OpponentMatchHit[]
}

const MAX_RECENT_MATCHES = 10
const MAX_RECENT_COMPOSITIONS = 5

const EMPTY_COMP_LABEL = '（相手ジョブ未入力）'

/** 同一編成のキー: ジョブ名を日本語ロケールでソートして連結（重複スロットもそのまま残す＝マルチセット） */
export function compositionMultisetLabel(jobs: string[]): string {
  if (jobs.length === 0) return EMPTY_COMP_LABEL
  return [...jobs].sort((a, b) => a.localeCompare(b, 'ja')).join(' / ')
}

export function summarizeOpponentMatchHits(hits: OpponentMatchHit[], teamKey: string): OpponentStatsSummary {
  let wins = 0
  let losses = 0
  let draws = 0
  let otherResults = 0
  const jobCounts = new Map<string, number>()

  for (const h of hits) {
    if (h.result === '勝ち') wins += 1
    else if (h.result === '負け') losses += 1
    else if (h.result === '引き分け') draws += 1
    else if (h.result) otherResults += 1
    for (const job of h.opponentJobs) {
      jobCounts.set(job, (jobCounts.get(job) ?? 0) + 1)
    }
  }

  const jobRanking = [...jobCounts.entries()]
    .map(([job, count]) => ({ job, count }))
    .sort((a, b) => b.count - a.count || a.job.localeCompare(b.job, 'ja'))

  const compositionAgg = new Map<string, { count: number; lastSeen: string }>()
  for (const h of hits) {
    const label = compositionMultisetLabel(h.opponentJobs)
    const prev = compositionAgg.get(label) ?? { count: 0, lastSeen: '' }
    prev.count += 1
    if (h.reviewDate > prev.lastSeen) prev.lastSeen = h.reviewDate
    compositionAgg.set(label, prev)
  }

  const total = hits.length
  const compositionRanking: OpponentCompositionRankingItem[] = [...compositionAgg.entries()]
    .map(([label, { count, lastSeen }]) => ({
      label,
      count,
      lastSeen,
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastSeen.localeCompare(a.lastSeen) ||
        a.label.localeCompare(b.label, 'ja')
    )

  return {
    teamKey,
    totalMatches: hits.length,
    wins,
    losses,
    draws,
    otherResults,
    recentHits: hits.slice(0, MAX_RECENT_MATCHES),
    jobRanking,
    compositionRanking,
    recentCompositions: hits.slice(0, MAX_RECENT_COMPOSITIONS),
  }
}

export function buildOpponentStatsSummary(
  rows: ReviewRowForOpponentStats[],
  teamNameRaw: string
): OpponentStatsSummary | null {
  const teamKey = teamNameRaw.trim()
  if (!teamKey) return null
  const hits = collectOpponentMatchHits(rows, teamNameRaw)
  return summarizeOpponentMatchHits(hits, teamKey)
}
