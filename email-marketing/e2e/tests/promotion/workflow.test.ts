import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Feature} from 'racejar/playwright'
import {expect} from '@playwright/test'
import {Given, When, Then} from '../../fixtures/steps.js'
import {sanityClient} from '../../fixtures/sanity-client.js'

const featureText = readFileSync(join(import.meta.dirname, 'workflow.feature'), 'utf-8')

const STUDIO_URL = process.env.STUDIO_URL ?? 'http://localhost:3333'

let currentPromotionId: string | null = null

const testDefinitions = [
  Given('I am in the Studio', async ({playwright: {page}}) => {
    await page.goto(STUDIO_URL)
    await page.waitForSelector('[data-testid="navmenu"]')
  }),

  Given('a promotion exists in {string} status', async ({playwright: {page}}, status: string) => {
    const doc = await sanityClient.fetch<{_id: string} | null>(
      `*[_type == "promotion" && *[_type == "workflow.state" && promotionId._ref == ^._id][0].status == $status][0]{_id}`,
      {status},
    )
    if (!doc) throw new Error(`No promotion found with workflow status: ${status}`)
    currentPromotionId = doc._id
  }),

  Given('a promotion exists targeting a named segment', async () => {
    const doc = await sanityClient.fetch<{_id: string} | null>(
      `*[_type == "promotion" && defined(segment)][0]{_id}`,
    )
    if (!doc) throw new Error('No promotion with segment found')
    currentPromotionId = doc._id
  }),

  When('I open that promotion', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/promotion;${currentPromotionId}`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  Then('I see the {string} action button', async ({playwright: {page}}, label: string) => {
    await expect(page.getByRole('button', {name: label})).toBeVisible()
  }),

  Then('the workflow badge shows {string}', async ({playwright: {page}}, status: string) => {
    await expect(
      page.locator('[data-testid="document-badges"]').getByText(status, {exact: false}),
    ).toBeVisible({timeout: 5_000})
  }),

  When('I click {string}', async ({playwright: {page}}, label: string) => {
    await page.getByRole('button', {name: label}).click()
  }),

  When('I confirm the approval dialog', async ({playwright: {page}}) => {
    await page.getByRole('button', {name: /confirm|yes/i}).click()
  }),

  When('I open the {string} inspector panel', async ({playwright: {page}}, panelName: string) => {
    await page.getByRole('button', {name: panelName}).click()
  }),

  Then('I see the workflow history section', async ({playwright: {page}}) => {
    await expect(page.getByText(/workflow/i)).toBeVisible({timeout: 5_000})
  }),

  Then('I see the preview accuracy indicator', async ({playwright: {page}}) => {
    await expect(page.getByText(/accuracy|preview/i)).toBeVisible({timeout: 5_000})
  }),

  Then('the segment name appears as a document badge', async ({playwright: {page}}) => {
    const segment = await sanityClient.fetch<{name: string} | null>(
      `*[_type == "promotion" && _id == $id][0].segment->{name}`,
      {id: currentPromotionId},
    )
    if (!segment?.name) throw new Error('Promotion has no segment')
    await expect(
      page.locator('[data-testid="document-badges"]').getByText(segment.name, {exact: false}),
    ).toBeVisible({timeout: 5_000})
  }),

  Then('the document has a badge showing {string}', async ({playwright: {page}}, status: string) => {
    await expect(
      page.locator('[data-testid="document-badges"]').getByText(status, {exact: false}),
    ).toBeVisible({timeout: 5_000})
  }),
]

Feature(featureText, testDefinitions)
