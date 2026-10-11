export type RefKind = 'issue' | 'pr'
export type RefState = 'open' | 'closed' | 'completed' | 'not_planned' | 'duplicate' | 'merged' | 'draft'

export type RefLabel = { name: string; color: string }

export type RefPull = {
  head: string
  base: string
  additions: number
  deletions: number
  files: number
  commits: number
  /** APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED, or null. */
  review: string | null
  /** SUCCESS | FAILURE | ERROR | PENDING | EXPECTED, or null when there are no checks. */
  checks: string | null
  mergedBy: string | null
  mergedAt: string | null
  reviewers: string[]
}

export type RefInfo = {
  /** Bumped when the shape changes, so entries cached by older code are fetched again. */
  v: 2
  id: string
  repo: string
  number: number
  kind: RefKind
  state: RefState
  title: string
  author: string
  url: string
  body: string
  /** A few cleaned-up lines of the body for the hover card. */
  excerpt: string[]
  comments: number
  reactions: number
  labels: RefLabel[]
  assignees: string[]
  milestone: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  /** Issues: the PRs that closed it. */
  closedBy: number[]
  pr: RefPull | null
}

/** null while unknown, 'missing' once GitHub said no such issue/PR. */
export type RefEntry = RefInfo | 'missing' | null

declare module 'claude-code' {
  interface PluginState {
    'gh-refs': {
      repo: string | null
      /** The terminal's background, painted behind the hover card so it hides the text it covers. */
      cardBg: string
      ref: StateFamily<RefEntry>
      selected: string | null
    }
  }
}
