import { expect, test } from '@playwright/test'

test('loads a living world and exposes simulation controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('EvoTerrarium')).toBeVisible()
  await expect(page.getByRole('application', { name: 'Interactive evolving ecosystem' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause simulation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add grazer' })).toBeVisible()
  await expect(page.getByText('FOOD WEB')).toBeVisible()
})

test('creates a deterministic world from a chosen seed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create a new world' }).click()
  await page.getByLabel('WORLD SEED').fill('E2E-2244')
  await page.getByRole('button', { name: 'Grow this world' }).click()
  await expect(page.getByText('A living world awakens')).toBeVisible()
})

test('pauses while the new-world dialog is open and restores the prior speed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Run at 20 times speed' }).click()
  await page.getByRole('button', { name: 'Create a new world' }).click()
  await expect(page.getByText('World paused while choosing.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause simulation' })).toHaveClass(/active/)
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('button', { name: 'Run at 20 times speed' })).toHaveClass(/active/)
})

test('keeps drag for exploration while a creation tool is armed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Run at 20 times speed' }).click()
  await page.getByRole('button', { name: 'Water' }).click()
  await expect(page.getByText('WORLD PAUSED · CREATION TOOL')).toBeVisible()
  await expect(page.getByText('Tap to apply · Drag to explore · Esc to finish')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause simulation' })).toHaveClass(/active/)
  await page.keyboard.press('Escape')
  await expect(page.getByText('WORLD PAUSED · CREATION TOOL')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Run at 20 times speed' })).toHaveClass(/active/)
})
