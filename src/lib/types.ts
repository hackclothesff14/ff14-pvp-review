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
