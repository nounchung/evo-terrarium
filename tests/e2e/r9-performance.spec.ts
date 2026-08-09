import { expect, test } from '@playwright/test'

const median = (values: number[]) => {
  const ordered = [...values].sort((first, second) => first - second)
  return ordered[Math.floor(ordered.length / 2)]
}

const isHeadlessScreenshotDriverWarning = (message: string) =>
  /^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels/.test(
    message,
  )

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('evo-terrarium:onboarding-v1', 'complete'))
})

test('records the R9.1 Classic/Living render budget and visual evidence', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const consoleFindings: string[] = []
  page.on('console', (message) => {
    if (
      (message.type() === 'error' || message.type() === 'warning') &&
      !isHeadlessScreenshotDriverWarning(message.text())
    ) {
      consoleFindings.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => consoleFindings.push(`pageerror: ${error.message}`))

  const evidence: Array<{
    renderer: 'classic' | 'living'
    buildMs: number
    fpsSamples: number[]
    medianFps: number
    revisionBeforePaint: number
    revisionAfterPaint: number
  }> = []

  for (const renderer of ['classic', 'living'] as const) {
    await page.goto(`/?terrain=${renderer}&seed=MOSS-1738`)
    const canvas = page.getByRole('application', { name: '互動式演化生態系統' })
    await expect(canvas).toBeVisible()
    await page.getByRole('button', { name: '暫停模擬' }).click()

    const fpsSamples: number[] = []
    await page.waitForTimeout(1_250)
    for (let sample = 0; sample < 3; sample += 1) {
      fpsSamples.push(Number(await canvas.getAttribute('data-fps')))
      await page.waitForTimeout(1_150)
    }
    const buildMs = Number(await canvas.getAttribute('data-terrain-build-ms'))
    const revisionBeforePaint = Number(await canvas.getAttribute('data-terrain-revision'))
    const screenshotPath = testInfo.outputPath(`r9.1-${testInfo.project.name}-${renderer}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    await testInfo.attach(`r9.1-${testInfo.project.name}-${renderer}`, {
      path: screenshotPath,
      contentType: 'image/png',
    })

    await page.getByRole('button', { name: '水域' }).click()
    const bounds = await canvas.boundingBox()
    expect(bounds).not.toBeNull()
    await canvas.click({ position: { x: bounds!.width * 0.58, y: bounds!.height * 0.52 } })
    await expect.poll(async () => Number(await canvas.getAttribute('data-terrain-revision'))).toBeGreaterThan(revisionBeforePaint)
    const revisionAfterPaint = Number(await canvas.getAttribute('data-terrain-revision'))

    evidence.push({
      renderer,
      buildMs,
      fpsSamples,
      medianFps: median(fpsSamples),
      revisionBeforePaint,
      revisionAfterPaint,
    })
  }

  const classic = evidence.find((item) => item.renderer === 'classic')!
  const living = evidence.find((item) => item.renderer === 'living')!
  const targetFps = testInfo.project.name === 'mobile-safari' ? 30 : 55
  const frameRateEnvironment = classic.medianFps >= targetFps ? 'device-like' : 'throttled'

  console.log(
    `R9_PERF ${JSON.stringify({
      project: testInfo.project.name,
      targetFps,
      frameRateEnvironment,
      evidence,
    })}`,
  )

  expect(classic.medianFps).toBeGreaterThan(0)
  expect(living.medianFps).toBeGreaterThan(0)
  expect(living.medianFps).toBeGreaterThanOrEqual(classic.medianFps * 0.8)
  expect(living.buildMs).toBeLessThanOrEqual(100)
  if (frameRateEnvironment === 'device-like') {
    expect(living.medianFps).toBeGreaterThanOrEqual(targetFps)
  }
  expect(consoleFindings).toEqual([])
})
