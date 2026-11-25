#!/usr/bin/env node
// Electron layout check (not part of vitest). Launches the built app, seeds
// realistic data and reports horizontal overflow at 800x600 plus the journal
// "Enregistrer" fold at 1200x800. Exit code 0 = clean, 1 = offenders found.
//
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright xvfb-run -a npm run check:layout
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const root = fileURLToPath(new URL('..', import.meta.url))

const SMALL_VIEWPORT = { w: 800, h: 600 }
const FOLD_VIEWPORT = { w: 1200, h: 800 }
const STUDENT_COUNT = 60
const VISIT_COUNT = 30
const NOON_HOUR = 12
const INE_LENGTH = 11
const SUBPIXEL_TOLERANCE = 1
const READY_TIMEOUT_MS = 15000
const ACTIVITIES = ['work', 'reading', 'computer', 'relaxation', 'game', 'other']
const SAVE_BUTTON_NAME = 'Enregistrer'
const ROUTES = [
  { page: 'journal', hash: '#/', ready: 'form button[type="submit"]' },
  { page: 'students', hash: '#/students', ready: 'main table tbody tr' },
  { page: 'statistics', hash: '#/statistics', ready: 'main svg' },
  { page: 'settings', hash: '#/settings', ready: 'main button' }
]

const offenders = []
const report = (pageName, size, path, reason) => {
  offenders.push(`${pageName}@${size.w}x${size.h}: ${path} ${reason}`)
}

const seed = async (page) => {
  await page.evaluate(
    async (cfg) => {
      const api = window.electronAPI
      const pad = (n) => String(n).padStart(2, '0')
      const ids = []
      for (let i = 0; i < cfg.studentCount; i++) {
        const res = await api.student.create({
          nom: 'Delacroix-Montgolfier' + i,
          prenom: 'Marie-Antoinette',
          classe: '4e B',
          ine: String(i).padStart(cfg.ineLength, 'X')
        })
        ids.push(res.data.id)
      }
      const now = new Date()
      const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const frequentations = []
      for (let i = 0; i < cfg.visitCount; i++) {
        const morning = i % 2 === 0
        const hour = morning ? 8 + (i % 4) : cfg.noonHour + 1 + (i % 4)
        frequentations.push({
          startsAt: `${day}T${pad(hour)}:${pad(i % 60)}:00`,
          activity: cfg.activities[i % cfg.activities.length],
          studentId: ids[i % ids.length]
        })
      }
      await api.frequentation.createBatch({ frequentations })
    },
    {
      studentCount: STUDENT_COUNT,
      visitCount: VISIT_COUNT,
      noonHour: NOON_HOUR,
      ineLength: INE_LENGTH,
      activities: ACTIVITIES
    }
  )
  await page.reload()
}

const resize = async (app, page, size) => {
  await app.evaluate(
    ({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h),
    size
  )
  await page.waitForFunction((w) => window.innerWidth === w, size.w)
}

const inPageOverflow = (tolerance) => {
  const out = []
  const main = document.querySelector('main')
  const describe = (el) => {
    const parts = []
    for (let node = el; node && node !== main; node = node.parentElement) {
      parts.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : ''))
    }
    const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24) ?? ''
    return parts.slice(-3).join('>') + (label ? ` "${label}"` : '')
  }
  const doc = document.documentElement
  if (doc.scrollWidth > doc.clientWidth) {
    out.push({
      path: 'html',
      reason: `page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`
    })
  }
  if (!main) {
    out.push({ path: 'main', reason: 'missing' })
    return out
  }
  if (main.scrollWidth > main.clientWidth) {
    out.push({
      path: 'main',
      reason: `scrolls horizontally (${main.scrollWidth} > ${main.clientWidth})`
    })
  }
  const isScroller = (el) => {
    const ox = getComputedStyle(el).overflowX
    return (ox === 'auto' || ox === 'scroll') && [...el.children].some((c) => c.tagName === 'TABLE')
  }
  const mainRight = main.getBoundingClientRect().right
  for (const el of main.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      continue
    }
    let inScroller = false
    for (let n = el.parentElement; n && n !== main; n = n.parentElement) {
      if (isScroller(n)) {
        inScroller = true
        break
      }
    }
    if (!inScroller && !isScroller(el) && rect.right > mainRight + tolerance) {
      out.push({
        path: describe(el),
        reason: `extends ${Math.round(rect.right - mainRight)}px past main`
      })
    }
    const style = getComputedStyle(el)
    // 1px boxes are visually-hidden helpers (sr-only), not clipped controls
    if (
      el.clientWidth > 1 &&
      style.overflowX !== 'visible' &&
      !isScroller(el) &&
      style.textOverflow !== 'ellipsis'
    ) {
      if (el.scrollWidth > el.clientWidth + tolerance) {
        out.push({
          path: describe(el),
          reason: `clips content (${el.scrollWidth} > ${el.clientWidth})`
        })
      }
    }
    if (el.tagName === 'BUTTON') {
      if (
        el.scrollWidth > el.clientWidth + tolerance ||
        el.scrollHeight > el.clientHeight + tolerance
      ) {
        out.push({ path: describe(el), reason: 'label overflows its button' })
      }
    }
  }
  return out
}

const checkOverflow = async (page) => {
  for (const route of ROUTES) {
    await page.evaluate((hash) => {
      location.hash = hash
    }, route.hash)
    await page.waitForSelector(route.ready, { timeout: READY_TIMEOUT_MS })
    const found = await page.evaluate(inPageOverflow, SUBPIXEL_TOLERANCE)
    for (const o of found) {
      report(route.page, SMALL_VIEWPORT, o.path, o.reason)
    }
  }
}

const checkFold = async (page) => {
  await page.evaluate((hash) => {
    location.hash = hash
  }, ROUTES[0].hash)
  await page.waitForSelector(ROUTES[0].ready, { timeout: READY_TIMEOUT_MS })
  const box = await page.getByRole('button', { name: SAVE_BUTTON_NAME }).boundingBox()
  const innerHeight = await page.evaluate(() => window.innerHeight)
  if (!box) {
    report('journal', FOLD_VIEWPORT, `button "${SAVE_BUTTON_NAME}"`, 'not found')
  } else if (box.y < 0 || box.y + box.height > innerHeight) {
    report(
      'journal',
      FOLD_VIEWPORT,
      `button "${SAVE_BUTTON_NAME}"`,
      `below the fold (bottom ${Math.round(box.y + box.height)} > ${innerHeight})`
    )
  }
}

const dir = mkdtempSync(join(tmpdir(), 'my-cdi-layout-'))
let app
try {
  app = await electron.launch({
    executablePath: join(root, 'node_modules/electron/dist/electron'),
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${dir}`, root]
  })
  const page = await app.firstWindow()
  await page.waitForSelector('main', { timeout: READY_TIMEOUT_MS })
  await seed(page)
  await resize(app, page, SMALL_VIEWPORT)
  await checkOverflow(page)
  await resize(app, page, FOLD_VIEWPORT)
  await checkFold(page)
} catch (error) {
  offenders.push(`script: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await app?.close()
  rmSync(dir, { recursive: true, force: true })
}

if (offenders.length > 0) {
  console.error(offenders.join('\n'))
  process.exitCode = 1
} else {
  console.log('Layout check passed')
}
