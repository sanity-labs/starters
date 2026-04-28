import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Feature} from 'racejar/playwright'
import {expect, type APIResponse} from '@playwright/test'
import {Given, When, Then} from '../../fixtures/steps.js'
import {sanityClient} from '../../fixtures/sanity-client.js'

const featureText = readFileSync(join(import.meta.dirname, 'email-preview.feature'), 'utf-8')

const STUDIO_URL = process.env.STUDIO_URL ?? 'http://localhost:3333'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

let currentPromotionId: string | null = null
let previewResponse: APIResponse | null = null

const testDefinitions = [
  Given('a promotion exists with email blocks', async () => {
    const doc = await sanityClient.fetch<{_id: string} | null>(
      `*[_type == "promotion" && count(emailSlots) > 0][0]{_id}`,
    )
    if (!doc) throw new Error('No promotion with email blocks found')
    currentPromotionId = doc._id
  }),

  When('I open the promotion preview at {string}', async ({playwright: {page}}, path: string) => {
    const url = path.replace('{id}', currentPromotionId!)
    await page.goto(`${FRONTEND_URL}${url}`)
    await page.waitForLoadState('networkidle')
  }),

  Then('I see the block content rendered', async ({playwright: {page}}) => {
    const section = await sanityClient.fetch<{headline: string} | null>(
      `*[_type == "promotion" && _id == $id][0].emailSlots[_type == "emailSection"][0]{headline}`,
      {id: currentPromotionId},
    )
    if (section?.headline) {
      await expect(page.getByText(section.headline, {exact: false})).toBeVisible()
    }
  }),

  Then('personalization tokens are replaced with sample data', async ({playwright: {page}}) => {
    const content = await page.locator('main').textContent()
    expect(content).not.toMatch(/\{\{.*?\}\}/)
  }),

  When('I click {string}', async ({playwright: {page}}, label: string) => {
    await page.getByRole('link', {name: label}).click()
    await page.waitForLoadState('networkidle')
  }),

  When('I fetch the preview endpoint at {string}', async ({playwright: {page}}, path: string) => {
    const url = path.replace('{id}', currentPromotionId!)
    previewResponse = await page.request.get(`${FRONTEND_URL}${url}`)
  }),

  Then('the response status is {int}', async (_ctx, status: number) => {
    expect(previewResponse?.status()).toBe(status)
  }),

  Then('the response sets X-Preview-Status to {string}', async (_ctx, value: string) => {
    expect(previewResponse?.headers()['x-preview-status']).toBe(value)
  }),

  Then('the response body contains email HTML', async () => {
    const body = await previewResponse!.text()
    expect(body.length).toBeGreaterThan(0)
    expect(body).toMatch(/<html|<body|<table/i)
  }),

  Given('I am in the Studio', async ({playwright: {page}}) => {
    await page.goto(STUDIO_URL)
    await page.waitForSelector('[data-testid="navmenu"]')
  }),

  When('I open that promotion in the Studio', async ({playwright: {page}}) => {
    await page.goto(`${STUDIO_URL}/structure/promotion;${currentPromotionId}`)
    await page.waitForSelector('[data-testid="form-view"]', {timeout: 10_000})
  }),

  When('I open the Presentation Tool preview', async ({playwright: {page}}) => {
    await page
      .getByRole('button', {name: /open preview|presentation/i})
      .first()
      .click()
  }),

  Then(
    'the preview pane shows the promotion at {string}',
    async ({playwright: {page}}, path: string) => {
      const expectedPath = path.replace('{id}', currentPromotionId!)
      await expect(page.locator(`iframe[src*="${expectedPath}"]`)).toBeVisible({timeout: 10_000})
    },
  ),

  Then('the {string} toggle is active', async ({playwright: {page}}, label: string) => {
    const toggle = page.getByRole('link', {name: label})
    await expect(toggle).toHaveClass(/bg-gray-900|active|selected/i)
  }),

  Then('the email blocks are rendered as React components', async ({playwright: {page}}) => {
    await expect(page.locator('.divide-y').first()).toBeVisible()
  }),
]

Feature(featureText, testDefinitions)
