import {describe, expect, it, vi} from 'vitest'

import {publishRelease} from './publishRelease'

const RELEASE = {
  id: 'dataset:proj1:production:_.releases.summer',
  type: 'system.release',
  releaseName: 'summer',
}

function harness(release: null | {state?: string}) {
  const client = {
    action: vi.fn().mockResolvedValue({transactionId: 'tx'}),
    agent: {},
    create: vi.fn(),
    createIfNotExists: vi.fn(),
    createOrReplace: vi.fn(),
    fetch: vi.fn().mockResolvedValue(release),
    getDocument: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
    transaction: vi.fn(),
    withConfig: vi.fn(),
  }

  const ctx = {
    client,
    clientFor: vi.fn().mockReturnValue(client),
    commitOps: vi.fn(),
    effectKey: 'effect-1',
    instanceId: 'instance-1',
    log: vi.fn(),
    setProgress: vi.fn(),
  }

  return {client, ctx}
}

describe('publish-release', () => {
  it('publishes immediately when no publishAt is bound', async () => {
    const {client, ctx} = harness({state: 'active'})

    await publishRelease({release: RELEASE, publishAt: null}, ctx)

    expect(client.action).toHaveBeenCalledWith(
      {actionType: 'sanity.action.release.publish', releaseId: 'summer'},
      {tag: 'publish-release'},
    )
  })

  it('schedules when publishAt is bound', async () => {
    const {client, ctx} = harness({state: 'active'})

    await publishRelease({release: RELEASE, publishAt: '2026-08-01T09:00:00Z'}, ctx)

    expect(client.action).toHaveBeenCalledWith(
      {
        actionType: 'sanity.action.release.schedule',
        releaseId: 'summer',
        publishAt: '2026-08-01T09:00:00Z',
      },
      {tag: 'publish-release'},
    )
  })

  it('routes reads and writes through the release resource, not the workflow one', async () => {
    const {ctx} = harness({state: 'active'})

    await publishRelease({release: RELEASE, publishAt: null}, ctx)

    expect(ctx.clientFor).toHaveBeenCalledWith(RELEASE.id)
  })

  it('reads the release by its system document id', async () => {
    const {client, ctx} = harness({state: 'active'})

    await publishRelease({release: RELEASE, publishAt: null}, ctx)

    expect(client.fetch).toHaveBeenCalledWith(
      expect.stringContaining('$releaseId'),
      {releaseId: '_.releases.summer'},
      {tag: 'read-release'},
    )
  })

  it.each(['published', 'scheduled', 'scheduling'])(
    'short-circuits a redelivery when the release is already %s',
    async (state) => {
      const {client, ctx} = harness({state})

      const result = await publishRelease({release: RELEASE, publishAt: null}, ctx)

      expect(result).toBeUndefined()
      expect(client.action).not.toHaveBeenCalled()
    },
  )

  it('acts when the release document cannot be read — failing loud beats never shipping', async () => {
    const {client, ctx} = harness(null)

    await publishRelease({release: RELEASE, publishAt: null}, ctx)

    expect(client.action).toHaveBeenCalled()
  })

  it('fails when no release is bound', async () => {
    const {ctx} = harness({state: 'active'})

    await expect(publishRelease({release: null, publishAt: null}, ctx)).rejects.toThrow(
      /requires a bound release/,
    )
  })
})
