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
const ERROR_EXCERPT = 300
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
        if (!res.success) {
          throw new Error(
            'seed student.create failed: ' +
              JSON.stringify(res.error ?? res).slice(0, cfg.errorExcerpt)
          )
        }
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
      const batch = await api.frequentation.createBatch({ frequentations })
      if (!batch.success) {
        throw new Error(
          'seed createBatch failed: ' +
            JSON.stringify(batch.error ?? batch).slice(0, cfg.errorExcerpt)
        )
      }
    },
    {
      errorExcerpt: ERROR_EXCERPT,
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
    // visually-hidden helpers (sr-only): absolutely positioned 1x1 box or clipped
    const srOnly =
      (style.position === 'absolute' && rect.width <= 1 && rect.height <= 1) ||
      (style.clip !== 'auto' && style.clip !== '') ||
      (style.clipPath !== 'none' && style.clipPath !== '')
    if (
      !srOnly &&
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

const gotoRoute = async (page, route, previous) => {
  const prevHandle = previous
    ? await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        window.__layoutPrev = el
        return el !== null
      }, previous.ready)
    : false
  await page.evaluate((hash) => {
    location.hash = hash
  }, route.hash)
  if (prevHandle) {
    // the previous page's own element must be gone before trusting the new DOM
    await page.waitForFunction(() => !window.__layoutPrev?.isConnected, undefined, {
      timeout: READY_TIMEOUT_MS
    })
  }
  await page.waitForSelector(route.ready, { timeout: READY_TIMEOUT_MS })
}

const checkOverflow = async (page) => {
  let previous
  for (const route of ROUTES) {
    await gotoRoute(page, route, previous)
    previous = route
    const found = await page.evaluate(inPageOverflow, SUBPIXEL_TOLERANCE)
    for (const o of found) {
      report(route.page, SMALL_VIEWPORT, o.path, o.reason)
    }
  }
}

const inPageSaveButton = ({ name, tolerance }) => {
  const out = []
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
  if (!button) {
    return [`button "${name}" not found`]
  }
  const box = button.getBoundingClientRect()
  let top = 0
  let bottom = window.innerHeight
  for (let n = button.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY
    if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') {
      const r = n.getBoundingClientRect()
      top = Math.max(top, r.top)
      bottom = Math.min(bottom, r.bottom)
    }
  }
  if (box.top < top - tolerance || box.bottom > bottom + tolerance) {
    out.push(
      `clipped by its scroll container (${Math.round(box.top)}-${Math.round(box.bottom)} not within ${Math.round(top)}-${Math.round(bottom)})`
    )
  }
  const bar = button.parentElement
  const barRect = bar.getBoundingClientRect()
  let scroller = null
  for (let n = bar.parentElement; n && !scroller; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY
    if (oy === 'auto' || oy === 'scroll') {
      scroller = n
    }
  }
  if (scroller && scroller.scrollHeight > scroller.clientHeight) {
    const visibleBottom = scroller.getBoundingClientRect().bottom
    if (Math.abs(barRect.bottom - visibleBottom) > tolerance) {
      const probeY = barRect.bottom + tolerance + 1
      for (const f of [0.25, 0.5, 0.75]) {
        const hit = document.elementFromPoint(barRect.left + barRect.width * f, probeY)
        if (
          hit?.closest('button, input, [role="button"], [role="radio"]') &&
          probeY < visibleBottom
        ) {
          out.push(
            `${hit.tagName.toLowerCase()} shows below the submit bar (bar bottom ${Math.round(barRect.bottom)}, scroll container bottom ${Math.round(visibleBottom)})`
          )
          break
        }
      }
    }
    const cardRect = bar.closest('form')?.parentElement?.getBoundingClientRect()
    if (cardRect) {
      const probeY = barRect.top + barRect.height / 2
      for (const x of [cardRect.left + 3, cardRect.right - 3]) {
        const hit = document.elementFromPoint(x, probeY)
        if (hit && !bar.contains(hit)) {
          out.push(
            `${hit.tagName.toLowerCase()} shows in the submit bar side gutter at x=${Math.round(x)}`
          )
        }
      }
    }
  }
  return out
}

const inPageClassLabels = (tolerance) => {
  const out = []
  for (const label of document.querySelectorAll('main ul > li > div > div:first-child > span')) {
    const lineHeight = parseFloat(getComputedStyle(label).lineHeight)
    if (label.getBoundingClientRect().height > lineHeight + tolerance) {
      out.push(`class label "${label.textContent.trim()}" wraps onto several lines`)
      break
    }
  }
  return out
}

const checkSaveButton = async (page, size) => {
  const found = await page.evaluate(inPageSaveButton, {
    name: SAVE_BUTTON_NAME,
    tolerance: SUBPIXEL_TOLERANCE
  })
  for (const reason of found) {
    report('journal', size, `button "${SAVE_BUTTON_NAME}"`, reason)
  }
}

const checkJournalSmall = async (page) => {
  await gotoRoute(page, ROUTES[0], ROUTES.at(-1))
  await checkSaveButton(page, SMALL_VIEWPORT)
  const labels = await page.evaluate(inPageClassLabels, SUBPIXEL_TOLERANCE)
  for (const reason of labels) {
    report('journal', SMALL_VIEWPORT, 'entries>li', reason)
  }
  await gotoRoute(page, ROUTES.at(-1), ROUTES[0])
}

const checkFold = async (page) => {
  await gotoRoute(page, ROUTES[0], ROUTES.at(-1))
  const box = await page.getByRole('button', { name: SAVE_BUTTON_NAME, exact: true }).boundingBox()
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
  await checkSaveButton(page, FOLD_VIEWPORT)
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
  await checkJournalSmall(page)
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
