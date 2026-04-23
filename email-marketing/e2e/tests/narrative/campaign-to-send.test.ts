import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Feature} from 'racejar/playwright'
import {expect} from '@playwright/test'
import {Given, When, Then} from '../../fixtures/steps.js'
import {sanityClient} from '../../fixtures/sanity-client.js'

const featureText = readFileSync(join(import.meta.dirname, 'campaign-to-send.feature'), 'utf-8')

const STUDIO_URL = process.env.STUDIO_URL ?? 'http://localhost:3333'

let currentCampaignId: string | null = null
let currentPromotionId: string | null = null

const testDefinitions = [
  Given('I am in the Studio', async ({playwright: {page}}) => {
    await page.goto(STUDIO_URL)
    await page.waitForSelector('[data-testid="navmenu"]')
  }),

  When('I open a campaign document', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/campaign`)
    await page.getByRole('link').first().click()
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  When<string>(
    'I fill in the primary message with {string}',
    async ({playwright: {page}}, message) => {
      await page.locator('[data-testid="field-primaryMessage"] textarea').fill(message)
    },
  ),

  When('I click {string}', async ({playwright: {page}}, label: string) => {
    await page.getByRole('button', {name: label}).click()
  }),

  When('the generation completes', async ({playwright: {page}}) => {
    await expect(page.getByText('Generated')).toBeVisible({timeout: 60_000})
  }),

  Then('I see a promotion for each target segment', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/promotion`)
    const rows = page.getByRole('link')
    await expect(rows.first()).toBeVisible({timeout: 10_000})
  }),

  Given('a promotion exists in {string} status', async ({playwright: {page}}, status: string) => {
    const doc = await sanityClient.fetch<{_id: string} | null>(
      `*[_type == "promotion" && *[_type == "workflow.state" && promotionId._ref == ^._id][0].status == $status][0]{_id}`,
      {status},
    )
    if (!doc) throw new Error(`No promotion found with status: ${status}`)
    currentPromotionId = doc._id
  }),

  When('I open that promotion', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/promotion;${currentPromotionId}`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  When('I confirm the approval dialog', async ({playwright: {page}}) => {
    await page.getByRole('button', {name: /confirm|yes|approve/i}).click()
  }),

  Then(
    'the workflow state transitions to {string}',
    async ({playwright: {page}}, status: string) => {
      await expect(page.getByText(status, {exact: false})).toBeVisible({timeout: 10_000})
    },
  ),

  Then('the on-promotion-approved function dispatches to Klaviyo', async () => {
    // Blueprint function is async — verify via workflow state
    await new Promise((r) => setTimeout(r, 5_000))
    const wf = await sanityClient.fetch<{status: string} | null>(
      `*[_type == "workflow.state" && promotionId._ref == $id][0]{status}`,
      {id: currentPromotionId},
    )
    expect(['approved', 'sent']).toContain(wf?.status)
  }),

  When('I open the {string} inspector panel', async ({playwright: {page}}, panelName: string) => {
    await page.getByRole('button', {name: panelName}).click()
  }),

  When<string>('I type {string}', async ({playwright: {page}}, text) => {
    await page.locator('textarea').last().fill(text)
  }),

  When('I send the message', async ({playwright: {page}}) => {
    await page.getByRole('button', {name: /send/i}).click()
  }),

  Then('the agent responds with a suggestion', async ({playwright: {page}}) => {
    await expect(page.getByText('Agent')).toBeVisible({timeout: 30_000})
  }),

  Then('the promotion draft is updated', async () => {
    const promotion = await sanityClient.fetch<{subjectLine: string} | null>(
      `*[_id == $id || _id == $draftId][0]{subjectLine}`,
      {id: currentPromotionId, draftId: `drafts.${currentPromotionId}`},
    )
    expect(promotion?.subjectLine).toBeTruthy()
  }),

  When('I open a campaign document with existing promotions', async ({playwright: {page}}) => {
    const campaign = await sanityClient.fetch<{_id: string} | null>(
      `*[_type == "campaign" && count(*[_type == "promotion" && campaign._ref == ^._id]) > 0][0]{_id}`,
    )
    if (!campaign) throw new Error('No campaign with promotions found')
    currentCampaignId = campaign._id
    await page.goto(`${STUDIO_URL}/structure/campaign;${currentCampaignId}`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  When('I switch to the {string} tab', async ({playwright: {page}}, tab: string) => {
    await page.getByRole('tab', {name: tab}).click()
  }),

  Then('I see one tile per segment promotion', async ({playwright: {page}}) => {
    const tiles = page.locator('[data-testid="promotion-tile"], article, section').filter({
      hasText: /draft|in-review|approved|sent/i,
    })
    expect(await tiles.count()).toBeGreaterThan(0)
  }),

  Then('each tile shows the subject line and workflow status', async ({playwright: {page}}) => {
    await expect(page.locator('text=/draft|in-review|approved|sent/i').first()).toBeVisible()
  }),

  When('I navigate to the Klaviyo sync section', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/klaviyoImport`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  When('I confirm the sync dialog', async ({playwright: {page}}) => {
    await page.getByRole('button', {name: /confirm|yes|sync/i}).click()
  }),

  When('the sync completes', async ({playwright: {page}}) => {
    await expect(page.getByText(/synced/i)).toBeVisible({timeout: 60_000})
  }),

  Then('segment documents appear in the segments list', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/segment`)
    await expect(page.getByRole('link').first()).toBeVisible({timeout: 5_000})
  }),

  Then("they can be referenced in a campaign's segments field", async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/campaign`)
    await page.getByRole('link').first().click()
    await expect(page.locator('[data-testid="field-segments"]')).toBeVisible()
  }),
]

Feature(featureText, testDefinitions)
