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
}

export type ReviewInput = Omit<Review, 'id' | 'created_at'>
