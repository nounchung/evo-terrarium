import { expect, test } from '@playwright/test'

const isHeadlessScreenshotDriverWarning = (message: string) =>
  /^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels/.test(
    message,
  )

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('evo-terrarium:onboarding-v1', 'complete'))
})

test('renders R9.2 species, life stages and behaviour evidence', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const consoleFindings: string[] = []
  page.on('console', (message) => {
    if (
      (message.type() === 'error' || message.type() === 'warning')
      && !isHeadlessScreenshotDriverWarning(message.text())
    ) {
      consoleFindings.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => consoleFindings.push(`pageerror: ${error.message}`))

  await page.goto('/?terrain=living&r9qa=species&seed=MOSS-1738')
  const canvas = page.getByRole('application', { name: '互動式演化生態系統' })
  await expect(canvas).toBeVisible()
  await page.getByRole('button', { name: '暫停模擬' }).click()

  await expect(canvas).toHaveAttribute('data-creature-renderer', 'raster-sprites')
  await expect(canvas).toHaveAttribute('data-creature-qa', 'species')
  await expect(canvas).toHaveAttribute('data-creature-life-stages', 'adult,juvenile,older')
  await expect(canvas).toHaveAttribute(
    'data-creature-behaviour-cues',
    'forage,hunt,flee,rest,mate,drink,migrate',
  )
  await expect(canvas).toHaveAttribute('data-creature-count', '7')
  await expect(canvas).toHaveAttribute('data-creature-detail', 'full')
  await expect(canvas).toHaveAttribute(
    'data-creature-qa-layout',
    testInfo.project.name === 'mobile-safari' ? 'compact' : 'desktop',
  )
  await expect(canvas).toHaveAttribute('data-creature-qa-scale', '1.55')
  await expect(canvas).toHaveAttribute('data-creature-build-ms', /^\d+(?:\.\d+)?$/)
  expect(Number(await canvas.getAttribute('data-creature-build-ms'))).toBeLessThanOrEqual(100)
  await expect(canvas).toHaveAttribute('data-fps', /^\d+(?:\.\d+)?$/, { timeout: 10_000 })
  // WebKit can capture the first uploaded sprite texture before Pixi's next
  // composition frame. Let the settled frame become the visual artifact.
  await page.waitForTimeout(600)

  const screenshotPath = testInfo.outputPath(`r9.2-${testInfo.project.name}-species.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await testInfo.attach(`r9.2-${testInfo.project.name}-species`, {
    path: screenshotPath,
    contentType: 'image/png',
  })
  expect(consoleFindings).toEqual([])
})

test('preserves behaviour cues in reduced-motion mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?terrain=living&r9qa=species&seed=MOSS-1738')
  const canvas = page.getByRole('application', { name: '互動式演化生態系統' })
  await expect(canvas).toHaveAttribute('data-reduced-motion', 'true')
  await expect(canvas).toHaveAttribute(
    'data-creature-behaviour-cues',
    'forage,hunt,flee,rest,mate,drink,migrate',
  )
})
