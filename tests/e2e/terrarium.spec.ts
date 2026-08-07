import { expect, test } from '@playwright/test'

test('loads a living world and exposes simulation controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('EvoTerrarium')).toBeVisible()
  await expect(page.getByRole('application', { name: 'Interactive evolving ecosystem' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause simulation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add grazer' })).toBeVisible()
})

test('creates a deterministic world from a chosen seed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create a new world' }).click()
  await page.getByLabel('WORLD SEED').fill('E2E-2244')
  await page.getByRole('button', { name: 'Grow this world' }).click()
  await expect(page.getByText('A living world awakens')).toBeVisible()
})

