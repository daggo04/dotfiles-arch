import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RefInfo, RefState } from '../types'

const PANE = 'gh-ref'
const MAX_REFS = 20
const BODY_LIMIT = 6000
const EXCERPT_LINES = 4
const EXCERPT_CHARS = 360

const repoAtom = atom({ plugin: 'gh-refs', key: 'repo' } as const, null)
const selected = atom({ plugin: 'gh-refs', key: 'selected' } as const, null)
const cardBg = atom({ plugin: 'gh-refs', key: 'cardBg' } as const, 'black')

// Fetch bookkeeping lives in the module: a reload simply refetches what is still unknown.
const queue: string[] = []
const inflight = new Set<string>()
const failed = new Set<string>()

// `#123` or `owner/repo#123`, not inside a word, URL anchor, HTML entity or existing link text.
const REF = /(?<![\w\[/&#.@-])(?:([A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*))?#([1-9]\d{0,6})(?![\w-])/g
// Segments left alone: fenced code, inline code, markdown links, bare URLs.
const SKIP = /(```[\s\S]*?(?:```|$)|`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\)|https?:\/\/\S+)/

const QUERY = `query($owner: String!, $name: String!, $n: Int!) {
  repository(owner: $owner, name: $name) {
    issueOrPullRequest(number: $n) {
      __typename
      ... on Issue {
        number title url state stateReason createdAt updatedAt closedAt body
        author { login }
        comments { totalCount }
        reactions { totalCount }
        labels(first: 8) { nodes { name color } }
        assignees(first: 4) { nodes { login } }
        milestone { title }
        closedByPullRequestsReferences(first: 3) { nodes { number } }
      }
      ... on PullRequest {
        number title url state isDraft createdAt updatedAt closedAt mergedAt body
        author { login }
        comments { totalCount }
        reactions { totalCount }
        labels(first: 8) { nodes { name color } }
        assignees(first: 4) { nodes { login } }
        milestone { title }
        headRefName baseRefName additions deletions changedFiles reviewDecision
        commits(last: 1) { totalCount nodes { commit { statusCheckRollup { state } } } }
        mergedBy { login }
        reviewRequests(first: 4) { nodes { requestedReviewer { ... on User { login } ... on Team { name } } } }
      }
    }
  }
}`

const refId = (repo: string, n: number | string) => `${repo}#${n}`

function scan(text: string, repo: string | null, onRef: (id: string, raw: string) => string): string {
  return text
    .split(SKIP)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(REF, (raw, other: string | undefined, n: string) => {
            const owner = other ?? repo
            return owner ? onRef(refId(owner, n), raw) : raw
          }),
    )
    .join('')
}

function findRefs(text: string, repo: string | null): string[] {
  const ids = new Set<string>()
  scan(text, repo, (id, raw) => (ids.add(id), raw))
  return [...ids].slice(0, MAX_REFS)
}

function parseRemote(url: string): string | null {
  const m = url.trim().match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
  return m ? `${m[1]}/${m[2]}` : null
}

/** The first few readable lines of a markdown body: no comments, images, tags or heading marks. */
function excerptOf(body: string): string[] {
  const text = body
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
  const lines: string[] = []
  let used = 0
  for (const raw of text.split('\n')) {
    const line = raw
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, '• ')
      .replace(/^\s*>\s?/, '')
      .trim()
    if (!line || /^[-=*_]{3,}$/.test(line)) continue
    const room = EXCERPT_CHARS - used
    if (room <= 0 || lines.length >= EXCERPT_LINES) break
    lines.push(line.length > room ? line.slice(0, room - 1) + '…' : line)
    used += line.length
  }
  return lines
}

function toInfo(id: string, node: any): RefInfo {
  const isPr = node.__typename === 'PullRequest'
  let state: RefState
  if (isPr) state = node.state === 'MERGED' ? 'merged' : node.state === 'CLOSED' ? 'closed' : node.isDraft ? 'draft' : 'open'
  else if (node.state === 'OPEN') state = 'open'
  else state = node.stateReason === 'NOT_PLANNED' ? 'not_planned' : node.stateReason === 'DUPLICATE' ? 'duplicate' : 'completed'
  const body = String(node.body ?? '')
  const lastCommit = node.commits?.nodes?.[0]?.commit

  return {
    v: 2,
    id,
    repo: id.slice(0, id.lastIndexOf('#')),
    number: node.number,
    kind: isPr ? 'pr' : 'issue',
    state,
    title: String(node.title ?? ''),
    author: node.author?.login ?? 'ghost',
    url: node.url,
    body: body.length > BODY_LIMIT ? body.slice(0, BODY_LIMIT) + '\n\n…' : body,
    excerpt: excerptOf(body),
    comments: node.comments?.totalCount ?? 0,
    reactions: node.reactions?.totalCount ?? 0,
    labels: (node.labels?.nodes ?? []).map((l: any) => ({ name: l.name, color: l.color })),
    assignees: (node.assignees?.nodes ?? []).map((a: any) => a.login),
    milestone: node.milestone?.title ?? null,
    createdAt: node.createdAt ?? '',
    updatedAt: node.updatedAt ?? '',
    closedAt: node.closedAt ?? null,
    closedBy: (node.closedByPullRequestsReferences?.nodes ?? []).map((p: any) => p.number),
    pr: isPr
      ? {
          head: node.headRefName,
          base: node.baseRefName,
          additions: node.additions ?? 0,
          deletions: node.deletions ?? 0,
          files: node.changedFiles ?? 0,
          commits: node.commits?.totalCount ?? 0,
          review: node.reviewDecision ?? null,
          checks: lastCommit?.statusCheckRollup?.state ?? null,
          mergedBy: node.mergedBy?.login ?? null,
          mergedAt: node.mergedAt ?? null,
          reviewers: (node.reviewRequests?.nodes ?? [])
            .map((r: any) => r.requestedReviewer?.login ?? r.requestedReviewer?.name)
            .filter(Boolean),
        }
      : null,
  }
}

async function fetchOne($: EngineInterface, id: string) {
  const repo = id.slice(0, id.lastIndexOf('#'))
  const [owner, name] = repo.split('/')
  const n = id.slice(id.lastIndexOf('#') + 1)
  try {
    const res = await $.process.run(
      ['gh', 'api', 'graphql', '-f', `query=${QUERY}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `n=${n}`],
      { timeoutMs: 15000 },
    )
    const node = res.exitCode === 0 ? JSON.parse(res.stdout)?.data?.repository?.issueOrPullRequest : null
    if (node) {
      await $.state.set({ plugin: 'gh-refs', key: 'ref', id }, toInfo(id, node))
    } else if (/NOT_FOUND|Could not resolve/.test(res.stderr + res.stdout)) {
      await $.state.set({ plugin: 'gh-refs', key: 'ref', id }, 'missing')
    } else {
      failed.add(id)
    }
  } catch {
    failed.add(id)
  } finally {
    inflight.delete(id)
  }
}

function drain($: EngineInterface) {
  while (queue.length > 0 && inflight.size < 4) {
    const id = queue.shift()!
    inflight.add(id)
    void fetchOne($, id)
  }
}

function enqueue(id: string) {
  if (inflight.has(id) || failed.has(id) || queue.includes(id)) return
  queue.push(id)
}

const STYLE: Record<RefState, { color: string; label: string }> = {
  open: { color: 'success', label: 'Open' },
  draft: { color: 'inactive', label: 'Draft' },
  merged: { color: 'merged', label: 'Merged' },
  closed: { color: 'error', label: 'Closed' },
  completed: { color: 'merged', label: 'Closed' },
  not_planned: { color: 'inactive', label: 'Not planned' },
  duplicate: { color: 'inactive', label: 'Duplicate' },
}

function glyph(info: RefInfo) {
  if (info.kind === 'pr') return info.state === 'merged' ? '⇲' : info.state === 'closed' ? '⨯' : '⇄'
  return info.state === 'open' ? '◉' : info.state === 'completed' ? '✓' : '⊘'
}

function ago(iso: string | null, now: number) {
  const t = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(t)) return ''
  const m = Math.max(0, Math.round((now - t) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  if (m < 60 * 24 * 60) return `${Math.round(m / 1440)}d ago`
  if (m < 60 * 24 * 730) return `${Math.round(m / 43200)}mo ago`
  return `${Math.round(m / 525600)}y ago`
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function shortLabel(info: RefInfo, repo: string | null) {
  return info.repo === repo ? `#${info.number}` : info.id
}

const CHECKS: Record<string, { color: string; text: string }> = {
  SUCCESS: { color: 'success', text: '✓ checks passed' },
  FAILURE: { color: 'error', text: '✗ checks failing' },
  ERROR: { color: 'error', text: '✗ checks errored' },
  PENDING: { color: 'warning', text: '● checks running' },
  EXPECTED: { color: 'warning', text: '● checks expected' },
}

const REVIEW: Record<string, { color: string; text: string }> = {
  APPROVED: { color: 'success', text: '✓ approved' },
  CHANGES_REQUESTED: { color: 'error', text: '± changes requested' },
  REVIEW_REQUIRED: { color: 'warning', text: '◌ review required' },
}

/** The rows the hover card and the detail pane share. */
function details(
  { Box, Text }: { Box: any; Text: any },
  info: RefInfo,
  now: number,
  { withExcerpt }: { withExcerpt: boolean },
) {
  const { color, label } = STYLE[info.state]
  const pr = info.pr
  const rows: any[] = []

  rows.push(
    <Box justifyContent="space-between">
      <Text>
        <Text color={color} bold>
          {glyph(info)} {label}
        </Text>
        <Text dimColor> {info.kind === 'pr' ? 'pull request' : 'issue'}</Text>
      </Text>
      <Text dimColor wrap="truncate-start">
        {info.id}
      </Text>
    </Box>,
  )
  rows.push(
    <Text bold wrap="wrap">
      {info.title}
    </Text>,
  )

  // Who and where.
  if (pr) {
    const verb =
      info.state === 'merged'
        ? `merged by @${pr.mergedBy ?? '?'} ${ago(pr.mergedAt, now)}`
        : info.state === 'closed'
          ? `closed ${ago(info.closedAt, now)}`
          : `opened ${ago(info.createdAt, now)}`
    rows.push(
      <Box marginTop={1} flexDirection="column">
        <Text wrap="truncate-end">
          <Text>@{info.author}</Text>
          <Text dimColor> · </Text>
          <Text color="suggestion">{pr.head}</Text>
          <Text dimColor> → </Text>
          <Text color="suggestion">{pr.base}</Text>
          <Text dimColor> · {verb}</Text>
        </Text>
        <Text wrap="truncate-end">
          <Text color="diffAdded">+{pr.additions}</Text> <Text color="diffRemoved">−{pr.deletions}</Text>
          <Text dimColor>
            {' '}
            · {plural(pr.files, 'file')} · {plural(pr.commits, 'commit')}
          </Text>
          {pr.checks && CHECKS[pr.checks] && <Text dimColor> · </Text>}
          {pr.checks && CHECKS[pr.checks] && <Text color={CHECKS[pr.checks]!.color}>{CHECKS[pr.checks]!.text}</Text>}
          {info.state === 'open' || info.state === 'draft'
            ? pr.review && REVIEW[pr.review] && <Text dimColor> · </Text>
            : null}
          {info.state === 'open' || info.state === 'draft'
            ? pr.review && REVIEW[pr.review] && <Text color={REVIEW[pr.review]!.color}>{REVIEW[pr.review]!.text}</Text>
            : null}
        </Text>
        {pr.reviewers.length > 0 && (info.state === 'open' || info.state === 'draft') && (
          <Text dimColor wrap="truncate-end">
            waiting on {pr.reviewers.map(r => `@${r}`).join(', ')}
          </Text>
        )}
      </Box>,
    )
  } else {
    const verb = info.state === 'open' ? `opened ${ago(info.createdAt, now)}` : `closed ${ago(info.closedAt, now)}`
    rows.push(
      <Box marginTop={1} flexDirection="column">
        <Text wrap="truncate-end">
          <Text>@{info.author}</Text>
          <Text dimColor> · {verb}</Text>
          {info.closedBy.length > 0 && (
            <Text dimColor> · fixed by {info.closedBy.map(n => `#${n}`).join(', ')}</Text>
          )}
        </Text>
      </Box>,
    )
  }

  if (withExcerpt && info.excerpt.length > 0) {
    rows.push(
      <Box marginTop={1} flexDirection="column">
        {info.excerpt.map(line => (
          <Text dimColor wrap="wrap">
            {line}
          </Text>
        ))}
      </Box>,
    )
  }

  if (info.labels.length > 0) {
    rows.push(
      <Box marginTop={1} flexWrap="wrap" columnGap={2}>
        {info.labels.map(l => (
          <Text>
            <Text color={`#${l.color}`}>●</Text> {l.name}
          </Text>
        ))}
      </Box>,
    )
  }

  const footer = [
    plural(info.comments, 'comment'),
    info.reactions > 0 ? plural(info.reactions, 'reaction') : '',
    `updated ${ago(info.updatedAt, now)}`,
    info.assignees.length > 0 ? `assigned ${info.assignees.map(a => `@${a}`).join(', ')}` : '',
    info.milestone ? `⚑ ${info.milestone}` : '',
  ].filter(Boolean)
  rows.push(
    <Box marginTop={info.labels.length > 0 ? 0 : 1}>
      <Text dimColor wrap="truncate-end">
        {footer.join(' · ')}
      </Text>
    </Box>,
  )

  return rows
}

async function openDetail($: EngineInterface, id: string) {
  await update($, selected, () => id)
  await $.ui.open({ id: PANE, title: id })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const res = await $.process.run(['git', 'remote', 'get-url', 'origin'], { timeoutMs: 5000 })
      const repo = res.exitCode === 0 ? parseRemote(res.stdout) : null
      await update($, repoAtom, () => repo)
    } catch {
      await update($, repoAtom, () => null)
    }
    try {
      // kitty knows its real background (theme included); other terminals get plain black.
      const res = await $.process.run(['kitty', '@', 'get-colors'], { timeoutMs: 3000 })
      const bg = res.exitCode === 0 ? res.stdout.match(/^background\s+(#[0-9a-fA-F]{6})/m)?.[1] : undefined
      if (bg) await update($, cardBg, () => bg)
    } catch {}
    $.clock.every(250, () => drain($))
    await $.command.register({
      name: 'gh-ref',
      description: 'Show a GitHub issue or PR of this repo in a pane',
      argumentHint: '<number | owner/repo#number>',
    })

    return next(e)
  })

  on('command.run', { command: 'gh-ref' }, async ($, e) => {
    const repo = await read($, repoAtom)
    const arg = e.args.trim().replace(/^#/, '')
    const m = arg.match(/^(?:([\w.-]+\/[\w.-]+)#)?(\d+)$/)
    const owner = m?.[1] ?? repo
    if (!m || !owner) return { text: 'Usage: /gh-ref 123 (inside a GitHub repo) or /gh-ref owner/repo#123' }
    const id = refId(owner, m[2]!)
    failed.delete(id)
    enqueue(id)
    await openDetail($, id)

    return { text: `Opened ${id}.` }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary) return next(e)
    const repo = await read($, repoAtom)
    const ids = findRefs(e.props.text, repo)
    if (ids.length === 0) return next(e)

    const known = new Map<string, RefInfo>()
    for (const id of ids) {
      const { value: entry = null } = await $.state.get({ plugin: 'gh-refs', key: 'ref', id })
      // Entries cached by an older version of this mod lack the fields the card draws.
      if (entry === null || (entry !== 'missing' && entry.v !== 2)) enqueue(id)
      else if (entry !== 'missing') known.set(id, entry)
    }
    if (known.size === 0) return next(e)

    const { Box, Text, Markdown, Button } = $.ui.resolve(e)
    const now = Date.now()
    const byHref = new Map<string, string>()
    const text = scan(e.props.text, repo, (id, raw) => {
      const info = known.get(id)
      if (!info) return raw
      byHref.set(info.url, id)
      return `[${raw}](${info.url})`
    })
    const columns = e.viewport?.columns ?? 100
    const cardWidth = Math.max(50, Math.min(100, columns - 6))
    // Hover groups are shared by every site this plugin draws, so name them per message.
    const scopeOf = (i: number) => `${e.requestId.slice(-40)}:${i}`
    const refs = [...known.values()]
    const bg = await read($, cardBg)

    return (
      <Box flexDirection="column">
        <Markdown
          key="body"
          text={text}
          pressableLinks={[...byHref.keys()]}
          onLinkPress={link => {
            const id = byHref.get(link.href)
            if (id) void openDetail($, id)
          }}
        />
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text dimColor>↳</Text>
          {refs.map((info, i) => (
            <Box hover={{ scope: scopeOf(i) }}>
              <Button key={`chip:${i}`} plain onPress={() => openDetail($, info.id)}>
                <Text color={STYLE[info.state].color}>
                  {glyph(info)} {shortLabel(info, repo)}
                </Text>
              </Button>
            </Box>
          ))}
          {refs.map((info, i) => (
            <Box
              position="absolute"
              bottom={1}
              left={2}
              width={cardWidth}
              display="none"
              hover={{ scope: scopeOf(i), display: 'flex' }}
              flexDirection="column"
              borderStyle="round"
              borderColor={STYLE[info.state].color}
              backgroundColor={bg}
              paddingX={1}
            >
              {details({ Box, Text }, info, now, { withExcerpt: true })}
              <Text dimColor italic>
                click for details · ctrl+click the link to open on GitHub
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Markdown, Link } = $.ui.resolve(e)
    const id = await read($, selected)
    if (!id) return <Text dimColor>No issue selected. Click a #ref in a reply, or run /gh-ref 123.</Text>
    const { value: entry = null } = await $.state.get({ plugin: 'gh-refs', key: 'ref', id })
    if (entry === null || (entry !== 'missing' && entry.v !== 2)) return <Text dimColor>Loading {id}…</Text>
    if (entry === 'missing') return <Text color="error">{id} is not an issue or PR.</Text>

    return (
      <Box flexDirection="column">
        {details({ Box, Text }, entry, Date.now(), { withExcerpt: false })}
        <Box marginTop={1}>
          <Link href={entry.url}>{entry.url}</Link>
        </Box>
        <Box marginTop={1}>
          <Markdown text={entry.body.trim() || '_No description provided._'} />
        </Box>
      </Box>
    )
  })
}
