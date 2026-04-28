import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Feature} from 'racejar/playwright'
import {expect} from '@playwright/test'
import {Given, When, Then} from '../../fixtures/steps.js'
import {sanityClient} from '../../fixtures/sanity-client.js'

const featureText = readFileSync(join(import.meta.dirname, 'generate-variants.feature'), 'utf-8')

const STUDIO_URL = process.env.STUDIO_URL ?? 'http://localhost:3333'

let currentCampaignId: string | null = null

const testDefinitions = [
  Given('I am in the Studio', async ({playwright: {page}}) => {
    await page.goto(STUDIO_URL)
    await page.waitForSelector('[data-testid="navmenu"]')
  }),

  Given('I open a campaign document', async ({playwright: {page}}) => {
    const campaign = await sanityClient.fetch<{_id: string} | null>(
      `*[_type == "campaign"][0]{_id}`,
    )
    if (!campaign) throw new Error('No campaign found')
    currentCampaignId = campaign._id
    await page.goto(`${STUDIO_URL}/structure/campaign;${currentCampaignId}`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  Then('I see the {string} action button', async ({playwright: {page}}, label: string) => {
    await expect(page.getByRole('button', {name: label})).toBeVisible()
  }),

  Given('the campaign has no primary message', async () => {
    await sanityClient.patch(currentCampaignId!).unset(['primaryMessage']).commit()
  }),

  Then('the {string} button is disabled', async ({playwright: {page}}, label: string) => {
    await page.reload()
    await expect(page.getByRole('button', {name: label})).toBeDisabled()
  }),

  Given('the campaign has segments and a primary message', async ({playwright: {page}}) => {
    const segment = await sanityClient.fetch<{_id: string} | null>(`*[_type == "segment"][0]{_id}`)
    if (!segment) throw new Error('No segments available — run Resend sync first')
    await sanityClient
      .patch(currentCampaignId!)
      .set({
        primaryMessage: 'Test campaign for e2e',
        segments: [{_type: 'reference', _ref: segment._id, _key: 'e2e-seg-1'}],
      })
      .commit()
    await page.reload()
  }),

  When('I click {string}', async ({playwright: {page}}, label: string) => {
    await page.getByRole('button', {name: label}).click()
  }),

  Then('a progress dialog appears', async ({playwright: {page}}) => {
    await expect(page.getByRole('dialog')).toBeVisible({timeout: 5_000})
  }),

  Then('the dialog shows generation progress text', async ({playwright: {page}}) => {
    await expect(page.getByRole('dialog').getByText(/generating|fetching/i)).toBeVisible({
      timeout: 5_000,
    })
  }),

  When('the generation completes', async ({playwright: {page}}) => {
    await expect(page.getByText(/generated/i)).toBeVisible({timeout: 60_000})
    await page.getByRole('button', {name: /close|dismiss/i}).click()
  }),

  When('I switch to the {string} tab', async ({playwright: {page}}, tab: string) => {
    await page.getByRole('tab', {name: tab}).click()
  }),

  Then('I see promotion tiles for the base and each segment', async ({playwright: {page}}) => {
    await expect(page.getByText('Base')).toBeVisible({timeout: 5_000})
  }),

  Then(
    'each created promotion has a workflow state of {string}',
    async ({playwright: {page}}, status: string) => {
      const promotions = await sanityClient.fetch<Array<{_id: string}> | null>(
        `*[_type == "promotion" && campaign._ref == $id]{_id}`,
        {id: currentCampaignId},
      )
      for (const p of promotions ?? []) {
        const wf = await sanityClient.fetch<{status: string} | null>(
          `*[_type == "workflow.state" && promotionId._ref == $id][0]{status}`,
          {id: p._id},
        )
        expect(wf?.status).toBe(status)
      }
    },
  ),
]

Feature(featureText, testDefinitions)
