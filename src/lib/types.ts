export type Review = {
  id: string
  created_at: string
  review_date: string
  opponent: string
  members: string
  jobs: string
  content: string
  video_url: string
  matches?: string | null
  /** scrim=スクリム, tournament=大会 */
  record_type?: string | null
  /** 大会の試合結果（任意） */
  result_summary?: string | null
}

export type ReviewInput = Omit<Review, 'id' | 'created_at'>

/** 課題ページ（issue_items） */
export type IssueItem = {
  id: string
  title: string
  body: string
  status: string
  progress: number
  /** 進捗の状況（自由記述） */
  progress_note: string
  created_at: string
  updated_at: string
}
