import { expect, mock, test } from 'claude-code/testing'

const PR = {
  __typename: 'PullRequest',
  number: 12,
  title: 'Sidebar crashes on resume',
  url: 'https://github.com/acme/widgets/pull/12',
  state: 'OPEN',
  isDraft: false,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
  closedAt: null,
  mergedAt: null,
  body: '<!-- template -->\r\n## Summary\r\n\r\nFixes the **crash** on resume.\r\n- [x] tested',
  author: { login: 'dagobh' },
  comments: { totalCount: 3 },
  reactions: { totalCount: 0 },
  labels: { nodes: [{ name: 'bug', color: 'd73a4a' }] },
  assignees: { nodes: [] },
  milestone: null,
  headRefName: 'fix-resume',
  baseRefName: 'main',
  additions: 40,
  deletions: 2,
  changedFiles: 3,
  reviewDecision: 'APPROVED',
  commits: { totalCount: 2, nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
  mergedBy: null,
  reviewRequests: { nodes: [] },
}

function fakeHost(on: Parameters<Parameters<typeof test>[1]>[1], calls: string[][]) {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, { key: 'engine' }, 'engine row')
  })
  on('process.run', (_$, e) => {
    calls.push([...e.argv])
    const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
    if (e.argv[0] === 'git') return { value: ok('git@github.com:acme/widgets.git\n') }
    if (e.argv.includes('n=12') && e.argv.includes('owner=acme')) {
      return { value: ok(JSON.stringify({ data: { repository: { issueOrPullRequest: PR } } })) }
    }
    return { value: { exitCode: 1, stdout: '', stderr: 'gh: Could not resolve to an issue or pull request', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

test('valid refs become links with a hover card; unknown ones stay plain', async ($, on) => {
  const clock = mock.clock(on)
  const calls: string[][] = []
  fakeHost(on, calls)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'gh-refs',
      surface,
      component: 'AssistantMessage',
      props: { text: 'Fixed in #12, unlike #99 and `#12` in code.', isFirstOfReply: true },
    })
    // First draw: nothing known yet, so the engine's own row draws.
    await clock.advance(1000)
    const body = await ui.find({ key: 'body' })
    expect(body).toBeDefined()
    const drawn = JSON.stringify(await ui.drawn())
        expect(drawn).toContain('`#12`')
    expect(drawn).not.toContain('[#99]')
    expect(drawn).toContain('[#12](https://github.com/acme/widgets/pull/12)')
    expect(drawn).toContain('Sidebar crashes on resume')
    expect(drawn).toContain('fix-resume')
    expect(drawn).toContain('checks passed')
    expect(drawn).toContain('approved')
    expect(drawn).toContain('Fixes the crash on resume.')
    expect(drawn).not.toContain('template')
    await ui.unmount()
  }
  expect(calls.filter(c => c[0] === 'gh').length).toBe(2)
})
