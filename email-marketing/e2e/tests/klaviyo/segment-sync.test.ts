import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Feature} from 'racejar/playwright'
import {expect} from '@playwright/test'
import {Given, When, Then} from '../../fixtures/steps.js'
import {sanityClient} from '../../fixtures/sanity-client.js'

const featureText = readFileSync(join(import.meta.dirname, 'segment-sync.feature'), 'utf-8')

const STUDIO_URL = process.env.STUDIO_URL ?? 'http://localhost:3333'

const testDefinitions = [
  Given('I am in the Studio', async ({playwright: {page}}) => {
    await page.goto(STUDIO_URL)
    await page.waitForSelector('[data-testid="navmenu"]')
  }),

  When('I navigate to the Klaviyo sync section', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/klaviyoImport`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  Then('I see the {string} button', async ({playwright: {page}}, label: string) => {
    await expect(page.getByRole('button', {name: label})).toBeVisible()
  }),

  When('I click the sync button', async ({playwright: {page}}) => {
    await page.getByRole('button', {name: /sync with klaviyo/i}).click()
  }),

  Then('a confirmation dialog appears', async ({playwright: {page}}) => {
    await expect(page.getByRole('dialog')).toBeVisible({timeout: 5_000})
  }),

  When('I confirm the sync', async ({playwright: {page}}) => {
    await page.getByRole('button', {name: /confirm|yes/i}).click()
  }),

  Then('a progress dialog appears', async ({playwright: {page}}) => {
    await expect(page.getByRole('dialog')).toBeVisible({timeout: 5_000})
  }),

  Then('the dialog shows {string}', async ({playwright: {page}}, text: string) => {
    await expect(page.getByRole('dialog').getByText(text, {exact: false})).toBeVisible({
      timeout: 5_000,
    })
  }),

  When('the sync completes successfully', async ({playwright: {page}}) => {
    await expect(page.getByText(/synced/i)).toBeVisible({timeout: 60_000})
  }),

  Then('the dialog shows a segment count', async ({playwright: {page}}) => {
    await expect(page.getByText(/\d+ segment/i)).toBeVisible({timeout: 5_000})
  }),

  Then('segment documents exist in the dataset', async () => {
    const count = await sanityClient.fetch<number>(`count(*[_type == "segment"])`)
    expect(count).toBeGreaterThan(0)
  }),

  Given('segments exist in the dataset', async () => {
    const count = await sanityClient.fetch<number>(`count(*[_type == "segment"])`)
    if (count === 0) throw new Error('No segments — run Klaviyo sync first')
  }),

  When('I open a segment document', async ({playwright: {page}}) => {
    const seg = await sanityClient.fetch<{_id: string} | null>(`*[_type == "segment"][0]{_id}`)
    if (!seg) throw new Error('No segment found')
    await page.goto(`${STUDIO_URL}/structure/segment;${seg._id}`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  Then('the {string} field is editable', async ({playwright: {page}}, fieldLabel: string) => {
    const field = page.locator(`[data-testid="field-${fieldLabel.toLowerCase().replace(/\s+/g, '')}"], label:has-text("${fieldLabel}")`)
    await expect(field).toBeVisible()
    const input = page.locator(`label:has-text("${fieldLabel}")`).locator('..').locator('input, textarea').first()
    await expect(input).not.toBeDisabled()
  }),

  Then('the {string} field is read-only', async ({playwright: {page}}, fieldLabel: string) => {
    const input = page.locator(`label:has-text("${fieldLabel}")`).locator('..').locator('input, textarea').first()
    const isReadOnly = await input.getAttribute('readonly')
    const isDisabled = await input.isDisabled()
    expect(isReadOnly !== null || isDisabled).toBeTruthy()
  }),
]

Feature(featureText, testDefinitions)
