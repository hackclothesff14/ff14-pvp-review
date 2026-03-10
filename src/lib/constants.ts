/** メンバー一覧（選択式の候補） */
export const MEMBERS_LIST = [
  'Zero Nox',
  'Buronko San',
  'minagi radeat',
  'Sakuya Sera',
  'Pochi Nyan',
  'Chiot Rainy',
  'Hack Clothes',
  'Nishi Battan',
] as const

/** ジョブ一覧 */
export const JOBS_LIST = [
  'ナイト',
  '戦士',
  '暗黒騎士',
  'ガンブレイカー',
  '白魔道士',
  '学者',
  '占星術師',
  '賢者',
  'モンク',
  '竜騎士',
  '忍者',
  '侍',
  'リーパー',
  'ヴァイパー',
  '吟遊詩人',
  '機工士',
  '踊り子',
  '黒魔道士',
  '召喚士',
  '赤魔道士',
  'ピクトマンサー',
] as const

/** ジョブのロール別カテゴリ（タンク=青・ヒーラー=緑・DPS=赤） */
const JOBS_BLUE = ['ナイト', '戦士', '暗黒騎士', 'ガンブレイカー'] as const
const JOBS_GREEN = ['白魔道士', '学者', '占星術師', '賢者'] as const
const JOBS_RED = [
  'モンク', '竜騎士', '忍者', '侍', 'リーパー', 'ヴァイパー',
  '吟遊詩人', '機工士', '踊り子', '黒魔道士', '召喚士', '赤魔道士', 'ピクトマンサー',
] as const

/** 選択されたジョブに応じた背景・枠色のTailwindクラスを返す（未選択は空） */
export function getJobCategoryClass(job: string): string {
  if (!job.trim()) return ''
  if (JOBS_BLUE.includes(job as (typeof JOBS_BLUE)[number])) return 'border-blue-200 bg-blue-100/80 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
  if (JOBS_GREEN.includes(job as (typeof JOBS_GREEN)[number])) return 'border-emerald-200 bg-emerald-100/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
  if (JOBS_RED.includes(job as (typeof JOBS_RED)[number])) return 'border-rose-200 bg-rose-100/80 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
  return ''
}

/** ジョブ名 → アイコン画像パス（public/jobicon 配下・青/緑/赤フォルダ） */
const JOB_ICON_MAP: Record<string, string> = {
  ナイト: '/jobicon/青/Paladin.png',
  戦士: '/jobicon/青/Warrior.png',
  暗黒騎士: '/jobicon/青/DarkKnight.png',
  ガンブレイカー: '/jobicon/青/Gunbreaker.png',
  白魔道士: '/jobicon/緑/WhiteMage.png',
  学者: '/jobicon/緑/Scholar.png',
  占星術師: '/jobicon/緑/Astrologian.png',
  賢者: '/jobicon/緑/Sage.png',
  モンク: '/jobicon/赤/Monk.png',
  竜騎士: '/jobicon/赤/Dragoon.png',
  忍者: '/jobicon/赤/Ninja.png',
  侍: '/jobicon/赤/Samurai.png',
  リーパー: '/jobicon/赤/Reaper.png',
  ヴァイパー: '/jobicon/赤/Viper.png',
  吟遊詩人: '/jobicon/赤/Bard.png',
  機工士: '/jobicon/赤/Machinist.png',
  踊り子: '/jobicon/赤/Dancer.png',
  黒魔道士: '/jobicon/赤/BlackMage.png',
  召喚士: '/jobicon/赤/Summoner.png',
  赤魔道士: '/jobicon/赤/RedMage.png',
  ピクトマンサー: '/jobicon/赤/Pictomancer.png',
}

export function getJobIconPath(job: string): string {
  return JOB_ICON_MAP[job] ?? ''
}

/** 直接入力用の選択肢の値 */
export const CUSTOM_MEMBER_VALUE = '__custom__'

/** メンバー・ジョブのデフォルト行数（5人制） */
export const DEFAULT_MEMBER_ROWS = 5

/** マップ一覧 */
export const MAPS_LIST = [
  'パライストラ',
  'ヴォルカニックハート',
  'クラウドナイン',
  '東方絡繰御殿',
  'レッドサンズ',
  'ベイサイドバトルグラウンド',
] as const

/** 勝ち負けの結果 */
export const RESULT_LIST = ['勝ち', '負け', '引き分け'] as const

/** OTへの突入時状況 */
export const OT_SITUATION_LIST = ['勝ちOT', '負けOT', 'OT突入なし'] as const

export type MemberJobPair = { member: string; job: string }

/** 試合1件の結果（メンバー・ジョブは試合ごと） */
export type MatchResult = {
  map: string
  result: string
  crystal_self: string
  crystal_opponent: string
  ot_situation: string
  end_minutes: string
  end_seconds: string
  is_ot: boolean
  /** この試合の自チーム メンバー・ジョブ */
  member_jobs: MemberJobPair[]
  /** 相手チームのジョブ（5人分・ジョブのみ） */
  opponent_jobs: string[]
}

/**
 * members カラムの値をパースする。
 * 新形式: JSON 配列 [{"member":"...","job":"..."}, ...]
 * 旧形式: そのまま文字列（カンマ区切りなど）
 */
export function parseMemberJobs(members: string | null | undefined): MemberJobPair[] {
  if (!members?.trim()) return []
  const trimmed = members.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.every((p) => p && typeof p.member === 'string' && typeof p.job === 'string')) {
        return parsed as MemberJobPair[]
      }
    } catch {
      // fall through to legacy
    }
  }
  return []
}

/**
 * メンバー・ジョブのペア配列を DB 用の文字列に変換する
 */
export function serializeMemberJobs(pairs: MemberJobPair[]): string {
  return JSON.stringify(pairs)
}

function getDefaultMatchInner(prevMemberJobs?: MemberJobPair[]): MatchResult {
  return {
    map: '',
    result: '',
    crystal_self: '',
    crystal_opponent: '',
    ot_situation: '',
    end_minutes: '',
    end_seconds: '',
    is_ot: true,
    member_jobs: prevMemberJobs
      ? prevMemberJobs.map((p) => ({ ...p }))
      : Array.from({ length: DEFAULT_MEMBER_ROWS }, () => ({ member: '', job: '' })),
    opponent_jobs: ['', '', '', '', ''],
  }
}

export function getDefaultMatch(prevMemberJobs?: MemberJobPair[]): MatchResult {
  return getDefaultMatchInner(prevMemberJobs)
}

/**
 * 1件の match オブジェクトを正規化
 */
function normalizeMatch(p: unknown): MatchResult {
  const raw = p as Record<string, unknown>
  let member_jobs: MemberJobPair[] = Array.from({ length: DEFAULT_MEMBER_ROWS }, () => ({ member: '', job: '' }))
  if (Array.isArray(raw?.member_jobs)) {
    member_jobs = (raw.member_jobs as unknown[]).map((x) => {
      const q = x as Record<string, unknown>
      return {
        member: typeof q?.member === 'string' ? q.member : '',
        job: typeof q?.job === 'string' ? q.job : '',
      }
    })
    if (member_jobs.length < DEFAULT_MEMBER_ROWS) {
      member_jobs = [...member_jobs, ...Array.from({ length: DEFAULT_MEMBER_ROWS - member_jobs.length }, () => ({ member: '', job: '' }))]
    }
  }
  let opponent_jobs: string[] = ['', '', '', '', '']
  if (Array.isArray(raw?.opponent_jobs)) {
    opponent_jobs = (raw.opponent_jobs as unknown[]).slice(0, 5).map((x) => (typeof x === 'string' ? x : ''))
    while (opponent_jobs.length < 5) opponent_jobs.push('')
  } else if (typeof raw?.opponent_jobs === 'string' && raw.opponent_jobs.trim()) {
    opponent_jobs = raw.opponent_jobs.split(',').map((s) => s.trim()).slice(0, 5)
    while (opponent_jobs.length < 5) opponent_jobs.push('')
  }

  return {
    map: typeof raw?.map === 'string' ? raw.map : '',
    result: typeof raw?.result === 'string' ? raw.result : '',
    crystal_self: typeof raw?.crystal_self === 'string' ? raw.crystal_self : String(raw?.crystal_self ?? ''),
    crystal_opponent: typeof raw?.crystal_opponent === 'string' ? raw.crystal_opponent : String(raw?.crystal_opponent ?? ''),
    ot_situation: typeof raw?.ot_situation === 'string' ? raw.ot_situation : '',
    end_minutes: typeof raw?.end_minutes === 'string' ? raw.end_minutes : String(raw?.end_minutes ?? ''),
    end_seconds: typeof raw?.end_seconds === 'string' ? raw.end_seconds : String(raw?.end_seconds ?? ''),
    is_ot: typeof raw?.is_ot === 'boolean' ? raw.is_ot : true,
    member_jobs,
    opponent_jobs,
  }
}

/**
 * matches カラムの値をパースする
 * 注意: 既存データとの互換性を保つこと。フォーマット変更時は normalizeMatch で旧形式を吸収する。
 * パースに失敗すると [] を返すが、DB の値は変更されない（ReviewForm で上書きを防いでいる）。
 */
export function parseMatchResults(matchesJson: string | null | undefined): MatchResult[] {
  if (!matchesJson?.trim()) return []
  try {
    const parsed = JSON.parse(matchesJson.trim()) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((p) => normalizeMatch(p))
  } catch {
    return []
  }
}

export function serializeMatchResults(matches: MatchResult[]): string {
  return JSON.stringify(
    matches.map((m) => ({
      ...m,
      member_jobs: m.member_jobs.map((p) => ({ ...p, member: (p.member ?? '').trim() })),
    }))
  )
}

/** 動画URL + 視点（誰の視点か）+ タイトル */
export type VideoEntry = { url: string; viewpoint: string; title: string }

export function parseVideoUrl(videoUrl: string | undefined | null): VideoEntry[] {
  const s = videoUrl?.trim()
  if (!s) return []
  try {
    const parsed = JSON.parse(s) as unknown
    if (Array.isArray(parsed))
      return parsed.map((x) => ({
        url: typeof x?.url === 'string' ? x.url : '',
        viewpoint: typeof x?.viewpoint === 'string' ? x.viewpoint : '',
        title: typeof x?.title === 'string' ? x.title : '',
      }))
  } catch {
    // legacy single URL
  }
  return [{ url: s, viewpoint: '', title: '' }]
}

export function serializeVideos(videos: VideoEntry[]): string {
  return JSON.stringify(videos)
}
