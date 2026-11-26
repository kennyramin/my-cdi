#!/usr/bin/env node
// Electron end-to-end check of the CSV export (not part of vitest). Launches the built app on a
// throwaway --user-data-dir, seeds hostile data through window.electronAPI, drives the real
// Statistics / Students dialogs with the native save dialog stubbed from the main process (no
// production hook) and verifies the produced files byte by byte with an INDEPENDENT RFC 4180
// parser (not csv.ts). Exit code 0 = pass, 1 = failures printed, 2 = cannot run now (too close to
// the start of the school year to seed visits on distinct past days).
//
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright [AXE_SOURCE=/path/to/axe.min.js] \
//          TZ=Europe/Paris xvfb-run -a npm run check:export
//   - PLAYWRIGHT_MODULE is required: playwright is not a project dependency, point it at an install.
//   - AXE_SOURCE is optional: without it the axe pass is skipped with a notice.
//   - check:export aligns better-sqlite3 to the ELECTRON ABI for the run; this script aligns it
//     back to the NODE ABI when it ends so vitest keeps working.
//   - Not covered here: the EBUSY/EPERM "file locked" mapping (cannot be provoked portably on
//     Linux); it is covered by the adapter unit tests.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const root = fileURLToPath(new URL('..', import.meta.url))
const ELECTRON_BIN = join(root, 'node_modules/electron/dist/electron')

const READY_TIMEOUT_MS = 15000
const UI_TIMEOUT_MS = 8000
const QUIET_MS = 700
const SETTLE_MS = 300
const ERROR_EXCERPT = 300
const EXIT_FAIL = 1
const EXIT_CANNOT_RUN = 2
const SMALL_VIEWPORT = { w: 800, h: 600 }
const SUBPIXEL_TOLERANCE = 1
const TAB_LIMIT = 12
const MIN_DAYS_INTO_SCHOOL_YEAR = 3
const SCHOOL_YEAR_START_MONTH = 8
const BOM = [0xef, 0xbb, 0xbf]
const BOM_LENGTH = BOM.length
const WINDOWS_FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/
const FILE_NAME_PATTERN = /^mon-cdi-[a-z-]+-\d{4}-\d{2}-\d{2}(_\d{4}-\d{2}-\d{2})?\.csv$/
const UNGUARDED_FORMULA = /^[ \t\r   -   　﻿​-‍⁠]*[=+\-@]|^[\t\r]/

const LABELS = {
  statisticsTrigger: 'Exporter',
  studentsTrigger: 'Exporter la liste',
  statisticsTitle: 'Exporter les statistiques',
  studentsTitle: 'Exporter la liste des élèves',
  confirm: 'Exporter',
  cancel: 'Annuler',
  names: 'Inclure les noms des élèves',
  legend: 'Données à exporter',
  acknowledge:
    "Je comprends que ce fichier contient des données personnelles et qu'il n'est pas chiffré.",
  schoolYear: 'Année scolaire',
  custom: 'Personnalisé',
  customStart: 'Date de début',
  customEnd: 'Date de fin',
  anonymized: 'Élève anonymisé',
  writeFailed: "Impossible d'écrire le fichier"
}
const KIND_LABELS = {
  journal: 'Journal des visites',
  visitsByDay: 'Visites par jour',
  visitsByActivity: 'Visites par activité',
  visitsByClass: 'Visites par classe'
}
const ACTIVITY_LABELS = {
  work: 'Travail',
  reading: 'Lecture',
  computer: 'Ordinateur',
  relaxation: 'Détente',
  game: 'Jeu de société',
  other: 'Autre'
}
const HEADERS = {
  journal: ['date', 'heure', 'classe', 'activité'],
  journalNames: ['date', 'heure', 'classe', 'activité', 'nom', 'prénom', 'INE'],
  visitsByDay: ['date', 'visites'],
  visitsByActivity: ['activité', 'visites'],
  visitsByClass: ['classe', 'visites'],
  students: ['nom', 'prénom', 'classe', 'INE', 'visites']
}
const FILE_SLUGS = {
  journal: 'journal',
  visitsByDay: 'visites-par-jour',
  visitsByActivity: 'visites-par-activite',
  visitsByClass: 'visites-par-classe',
  students: 'eleves'
}

const offenders = []
const expect = (ok, what) => {
  if (!ok) {
    offenders.push(what)
  }
}
const same = (actual, wanted, what) => {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(wanted)
  expect(left === right, `${what}: expected ${right.slice(0, 400)} got ${left.slice(0, 400)}`)
}

const alignAbi = (runtime) =>
  spawnSync(
    process.execPath,
    [join(root, 'scripts/align-better-sqlite3-abi.mjs'), `--runtime=${runtime}`],
    { cwd: root, stdio: 'inherit' }
  )

const pad = (n) => String(n).padStart(2, '0')
const localDay = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// School year as the Statistics page computes it: from 1 September, switching on month 8 (September).
const now = new Date()
const schoolStartYear =
  now.getMonth() >= SCHOOL_YEAR_START_MONTH ? now.getFullYear() : now.getFullYear() - 1
const SCHOOL_YEAR = {
  startDate: `${schoolStartYear}-09-01`,
  endDate: `${schoolStartYear + 1}-08-31`
}
const todayIso = localDay(now)
if (todayIso < `${schoolStartYear}-09-${pad(MIN_DAYS_INTO_SCHOOL_YEAR + 1)}`) {
  console.error('Too close to the start of the school year to seed visits on past days')
  process.exit(EXIT_CANNOT_RUN)
}

const DAY_ONE = `${schoolStartYear}-09-01`
const DAY_TWO = `${schoolStartYear}-09-02`
const EARLIER_A = `${schoolStartYear}-06-15`
const EARLIER_D = `${schoolStartYear}-06-20`
const CUSTOM_RANGE = { startDate: `${schoolStartYear}-06-16`, endDate: `${schoolStartYear}-06-25` }
const EMPTY_RANGE = { startDate: `${schoolStartYear}-02-01`, endDate: `${schoolStartYear}-02-05` }

const STUDENTS = {
  formula: { nom: '=cmd|x', prenom: 'Zoé', classe: '3-B', ine: '+123' },
  quote: { nom: 'Martin', prenom: 'O"Brien;Jr', classe: '3-B', ine: 'AB12345678C' },
  newline: { nom: 'Du\nrand', prenom: 'Léa', classe: '6A', ine: 'CD12345678E' },
  plain: { nom: 'Normand', prenom: 'Paul', classe: '5C', ine: 'EF12345678G' },
  spaced: { nom: ' =1', prenom: ' @x', classe: ' =2E', ine: ' +9' },
  leaver: { nom: 'Partant', prenom: 'Yvan', classe: '4D', ine: 'GH12345678I' }
}
const VISITS = [
  { who: 'formula', day: DAY_ONE, time: '08:10', activity: 'work' },
  { who: 'formula', day: DAY_TWO, time: '09:00', activity: 'reading' },
  { who: 'formula', day: EARLIER_A, time: '09:00', activity: 'game' },
  { who: 'quote', day: DAY_ONE, time: '08:20', activity: 'reading' },
  { who: 'newline', day: DAY_ONE, time: '08:30', activity: 'computer' },
  { who: 'plain', day: DAY_ONE, time: '08:40', activity: 'relaxation' },
  { who: 'plain', day: EARLIER_D, time: '09:00', activity: 'work' },
  { who: 'leaver', day: DAY_ONE, time: '08:50', activity: 'game' },
  { who: 'spaced', day: DAY_TWO, time: '10:00', activity: 'other' }
]
const ANONYMIZED = 'leaver'

const launch = async (userDataDir) => {
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`, root],
    env: { ...process.env }
  })
  const page = await app.firstWindow()
  await page.waitForSelector('main', { timeout: READY_TIMEOUT_MS })
  return { app, page }
}

const closeQuietly = async (app) => {
  try {
    await app.close()
  } catch {
    // already gone
  }
}

const call = (page, path, input) =>
  page.evaluate(
    async ({ p, i, excerpt }) => {
      const [group, method] = p.split('.')
      const res = await window.electronAPI[group][method](i)
      if (!res.success) {
        throw new Error(p + ' failed: ' + JSON.stringify(res).slice(0, excerpt))
      }
      return res.data
    },
    { p: path, i: input, excerpt: ERROR_EXCERPT }
  )

const callRaw = (page, path, input) =>
  page.evaluate(
    async ({ p, i }) => {
      const [group, method] = p.split('.')
      return window.electronAPI[group][method](i)
    },
    { p: path, i: input }
  )

// ---- independent RFC 4180 reader (';' separator, CRLF records, BOM handled by the caller) ----
const parseCsv = (text) => {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 2
      } else if (char === '"') {
        quoted = false
        index += 1
      } else {
        cell += char
        index += 1
      }
    } else if (char === '"' && cell === '') {
      quoted = true
      index += 1
    } else if (char === ';') {
      row.push(cell)
      cell = ''
      index += 1
    } else if (char === '\r' && text[index + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      index += 2
    } else if (char === '\r' || char === '\n' || char === '"') {
      throw new Error(`malformed CSV: unquoted ${JSON.stringify(char)} at offset ${index}`)
    } else {
      cell += char
      index += 1
    }
  }
  if (quoted) {
    throw new Error('malformed CSV: unterminated quote')
  }
  if (cell !== '' || row.length > 0) {
    throw new Error('malformed CSV: last record is not CRLF-terminated')
  }
  return rows
}

const readCsv = (path, what) => {
  expect(existsSync(path), `${what}: file exists`)
  if (!existsSync(path)) {
    return { bytes: Buffer.alloc(0), text: '', rows: [] }
  }
  const bytes = readFileSync(path)
  expect(
    BOM.every((byte, i) => bytes[i] === byte),
    `${what}: starts with the UTF-8 BOM EF BB BF`
  )
  const text = bytes.subarray(BOM_LENGTH).toString('utf8')
  expect(!text.startsWith('﻿'), `${what}: a single BOM`)
  let rows = []
  try {
    rows = parseCsv(text)
  } catch (error) {
    offenders.push(`${what}: ${error.message}`)
  }
  const widths = new Set(rows.map((r) => r.length))
  expect(widths.size <= 1, `${what}: every record has the same column count`)
  for (const cell of rows.flat()) {
    expect(!UNGUARDED_FORMULA.test(cell), `${what}: unguarded formula cell ${JSON.stringify(cell)}`)
  }
  return { bytes, text, rows }
}

const sortedRows = (rows) =>
  rows
    .map((r) => r.join('\u0000'))
    .sort()
    .map((r) => r.split('\u0000'))
const noTempFiles = (dir, what) =>
  expect(
    !readdirSync(dir).some((name) => name.endsWith('.tmp')),
    `${what}: no .tmp file left in ${dir}`
  )

// ---- expectations derived from the seed, independent of the application ----
const inRange = (day, range) => day >= range.startDate && day <= range.endDate
const guarded = (value) => `'${value}`
const safeCell = (value) => (UNGUARDED_FORMULA.test(value) ? guarded(value) : value)
const visitsIn = (range) => VISITS.filter((v) => inRange(v.day, range))
const classOf = (who) => safeCell((storedStudents[who] ?? STUDENTS[who]).classe)
const countBy = (visits, key) => {
  const counts = new Map()
  for (const v of visits) {
    const k = key(v)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}
const nonZeroRows = (rows) => sortedRows(rows.slice(1).filter((r) => r[1] !== '0'))
const expectedPairs = (counts) => sortedRows([...counts].map(([k, n]) => [k, String(n)]))

let ids = {}
let storedStudents = {}
const names = (who) => storedStudents[who] ?? STUDENTS[who]

const journalRows = (range, withNames) =>
  visitsIn(range).map((v) => {
    const base = [v.day, v.time, classOf(v.who), ACTIVITY_LABELS[v.activity]]
    if (!withNames) {
      return base
    }
    if (v.who === ANONYMIZED) {
      return [...base, LABELS.anonymized, '', '']
    }
    const s = names(v.who)
    return [...base, ...[s.nom, s.prenom, s.ine].map(safeCell)]
  })

const personalNeedles = () =>
  Object.keys(STUDENTS).flatMap((who) => {
    const s = names(who)
    return [s.nom.trim(), s.prenom.trim(), s.ine].filter((x) => x.length > 2)
  })

// ---- native save dialog stub (main process only) ----
const stubSave = (app, target) =>
  app.evaluate(({ dialog }, filePath) => {
    globalThis.__saveOptions = []
    dialog.showSaveDialog = async (...args) => {
      globalThis.__saveOptions.push(args[args.length - 1])
      return filePath === null ? { canceled: true } : { canceled: false, filePath }
    }
  }, target)
const saveOptions = (app) => app.evaluate(() => globalThis.__saveOptions)

// ---- navigation and UI helpers ----
const settle = (page, ms = SETTLE_MS) => page.waitForTimeout(ms)

const goStatistics = async (page) => {
  await page.evaluate(() => {
    window.location.hash = '#/statistics'
  })
  await page.reload()
  await page.getByRole('button', { name: LABELS.schoolYear, exact: true }).waitFor({
    timeout: UI_TIMEOUT_MS
  })
}

const goStudents = async (page) => {
  await page.evaluate(() => {
    window.location.hash = '#/students'
  })
  await page.reload()
  await page.waitForSelector('main table tbody tr', { timeout: UI_TIMEOUT_MS })
}

const chooseSchoolYear = (page) =>
  page.getByRole('button', { name: LABELS.schoolYear, exact: true }).click()

const chooseCustom = async (page, range) => {
  await page.getByRole('button', { name: LABELS.custom, exact: true }).click()
  await page.getByLabel(LABELS.customStart).fill(range.startDate)
  await page.getByLabel(LABELS.customEnd).fill(range.endDate)
  await settle(page)
}

const statisticsTrigger = (page) =>
  page.getByRole('button', { name: LABELS.statisticsTrigger, exact: true })
const studentsTrigger = (page) =>
  page.getByRole('button', { name: LABELS.studentsTrigger, exact: true })
const statisticsDialog = (page) => page.getByRole('dialog', { name: LABELS.statisticsTitle })
const studentsDialog = (page) => page.getByRole('dialog', { name: LABELS.studentsTitle })
const confirmButton = (dialog) => dialog.getByRole('button', { name: LABELS.confirm, exact: true })

const openStatisticsDialog = async (page) => {
  await statisticsTrigger(page).click()
  const dialog = statisticsDialog(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  return dialog
}

const toastWith = (page, pattern) => page.getByRole('alert').filter({ hasText: pattern })

const waitToast = async (page, pattern, what) => {
  try {
    await toastWith(page, pattern).first().waitFor({ timeout: UI_TIMEOUT_MS })
  } catch {
    offenders.push(`${what}: toast ${pattern} did not appear`)
  }
}

const waitHidden = async (locator, what) => {
  try {
    await locator.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS })
  } catch {
    offenders.push(`${what} did not close`)
  }
}

// Picks a kind (optionally ticking the names box first), confirms and returns the saved options.
const exportKind = async (page, app, target, kind, { names: tickNames = false, then } = {}) => {
  await stubSave(app, target)
  const dialog = await openStatisticsDialog(page)
  if (tickNames) {
    await dialog.getByRole('checkbox', { name: LABELS.names }).check()
  }
  if (then) {
    await then(dialog)
  }
  await dialog.getByRole('radio', { name: KIND_LABELS[kind] }).check()
  return dialog
}

const finishExport = async (page, dialog, pattern, what) => {
  await confirmButton(dialog).click()
  await waitToast(page, pattern, what)
  await waitHidden(dialog, `${what}: dialog`)
}

const countLabel = (rows) =>
  rows === 0 ? /^0 ligne exportée$/ : new RegExp(`^${rows} lignes? exportées?$`)

// ---- layout / a11y helpers ----
const axeSource = (() => {
  const path = process.env.AXE_SOURCE
  return path && existsSync(path) ? readFileSync(path, 'utf8') : null
})()
if (!axeSource) {
  console.warn('AXE_SOURCE not set (or missing): the axe pass on the dialogs is skipped')
}

const axeViolations = async (page) => {
  if (!axeSource) {
    return []
  }
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    const dialogs = document.querySelectorAll('[role="dialog"]')
    const top = dialogs[dialogs.length - 1]
    const result = await window.axe.run(top)
    return result.violations.map((v) => `${v.id}(${v.nodes.length})`)
  })
}

const dialogLayoutProblems = (page) =>
  page.evaluate(
    ({ tolerance }) => {
      const dialogs = document.querySelectorAll('[role="dialog"]')
      const dialog = dialogs[dialogs.length - 1]
      const box = dialog.getBoundingClientRect()
      const inside = (r) =>
        r.left >= -tolerance &&
        r.top >= -tolerance &&
        r.right <= window.innerWidth + tolerance &&
        r.bottom <= window.innerHeight + tolerance
      const problems = []
      if (!inside(box)) {
        problems.push('dialog leaves the viewport')
      }
      if (dialog.scrollWidth > dialog.clientWidth + tolerance) {
        problems.push('dialog scrolls sideways')
      }
      for (const button of dialog.querySelectorAll('button')) {
        const r = button.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!inside(r) || !hit || !dialog.contains(hit)) {
          problems.push(`button "${button.textContent}" is cut off or covered`)
        }
      }
      return problems
    },
    { tolerance: SUBPIXEL_TOLERANCE }
  )

const checkDialog = async (page, label) => {
  for (const problem of await dialogLayoutProblems(page)) {
    offenders.push(`${label}: ${problem}`)
  }
  const violations = await axeViolations(page)
  expect(violations.length === 0, `${label}: axe violations ${violations.join(', ')}`)
}

// The toolbar holding `triggerName` stays inside the viewport, does not scroll sideways, and none
// of its buttons overlaps another one.
const checkToolbar = async (page, triggerName, label) => {
  const problems = await page.evaluate(
    ({ name, tolerance }) => {
      const trigger = [...document.querySelectorAll('main button')].find((b) =>
        (b.textContent ?? '').trim().endsWith(name)
      )
      if (!trigger) {
        return [`button "${name}" not found`]
      }
      const toolbar = trigger.parentElement
      const out = []
      const doc = document.documentElement
      if (doc.scrollWidth > doc.clientWidth + tolerance) {
        out.push('page scrolls horizontally')
      }
      if (toolbar.scrollWidth > toolbar.clientWidth + tolerance) {
        out.push(`toolbar overflows (${toolbar.scrollWidth} > ${toolbar.clientWidth})`)
      }
      const boxes = [...toolbar.querySelectorAll('button')].map((b) => ({
        text: (b.textContent ?? '').trim(),
        r: b.getBoundingClientRect()
      }))
      for (const { text, r } of boxes) {
        if (r.left < -tolerance || r.right > window.innerWidth + tolerance) {
          out.push(`button "${text}" leaves the viewport horizontally`)
        }
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i].r
          const b = boxes[j].r
          const overlaps =
            a.left < b.right - tolerance &&
            b.left < a.right - tolerance &&
            a.top < b.bottom - tolerance &&
            b.top < a.bottom - tolerance
          if (overlaps) {
            out.push(`buttons "${boxes[i].text}" and "${boxes[j].text}" overlap`)
          }
        }
      }
      return out
    },
    { name: triggerName, tolerance: SUBPIXEL_TOLERANCE }
  )
  for (const problem of problems) {
    offenders.push(`${label}: ${problem}`)
  }
}

const resizeTo = (app, size) =>
  app.evaluate(
    ({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h),
    size
  )

const activeDescription = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return el ? { tag: el.tagName, text: (el.textContent ?? '').trim() } : null
  })

// ---- scenarios ----
const seed = async (page) => {
  for (const [who, student] of Object.entries(STUDENTS)) {
    const created = await call(page, 'student.create', student)
    ids[who] = created.id
    storedStudents[who] = {
      nom: created.nom,
      prenom: created.prenom,
      classe: created.classe,
      ine: created.ine
    }
  }
  for (const visit of VISITS) {
    await call(page, 'frequentation.createBatch', {
      frequentations: [
        {
          startsAt: `${visit.day}T${visit.time}:00`,
          activity: visit.activity,
          studentId: ids[visit.who]
        }
      ]
    })
  }
  await call(page, 'student.anonymize', { ids: [ids[ANONYMIZED]] })
}

const checkSeedStored = () => {
  const spaced = names('spaced')
  expect(
    UNGUARDED_FORMULA.test(spaced.nom) && UNGUARDED_FORMULA.test(spaced.classe),
    `seed: formula-looking name and class stored (the app trims the leading spaces on input; got ${JSON.stringify(spaced)})`
  )
  expect(names('newline').nom.includes('\n'), 'seed: the newline survived student.create')
  expect(
    names('formula').ine === '+123',
    `seed: INE +123 stored as-is (got ${names('formula').ine})`
  )
}

const checkFileName = (options, kind, expectedDate, what) => {
  const path = options?.defaultPath ?? ''
  const name = basename(path)
  expect(FILE_NAME_PATTERN.test(name), `${what}: default file name ${name} matches the pattern`)
  expect(!WINDOWS_FORBIDDEN.test(name), `${what}: file name has no forbidden Windows character`)
  expect(
    name === `mon-cdi-${FILE_SLUGS[kind]}-${expectedDate}.csv`,
    `${what}: default file name is mon-cdi-${FILE_SLUGS[kind]}-${expectedDate}.csv (got ${name})`
  )
}
const SCHOOL_YEAR_DATE = `${SCHOOL_YEAR.startDate}_${SCHOOL_YEAR.endDate}`

const scenarioJournal = async (page, app, out) => {
  // 1. Journal without names
  const plain = join(out, 'journal-plain.csv')
  await goStatistics(page)
  await chooseSchoolYear(page)
  let dialog = await exportKind(page, app, plain, 'journal')
  const periodText = await dialog.innerText()
  const [y1, m1, d1] = SCHOOL_YEAR.startDate.split('-')
  expect(
    periodText.includes(`${d1}/${m1}/${y1}`),
    `journal: the dialog states the chosen period (got "${periodText.slice(0, 160)}")`
  )
  const rowsExpected = journalRows(SCHOOL_YEAR, false)
  await finishExport(page, dialog, countLabel(rowsExpected.length), 'journal plain')
  let file = readCsv(plain, 'journal plain')
  same(file.rows[0], HEADERS.journal, 'journal plain: header')
  same(sortedRows(file.rows.slice(1)), sortedRows(rowsExpected), 'journal plain: rows')
  expect(
    file.rows.slice(1).every((r) => r.length === HEADERS.journal.length),
    'journal plain: no name/INE column'
  )
  expect(
    !personalNeedles().some((needle) => file.text.includes(needle)),
    'journal plain: no personal data in the file'
  )
  expect(
    file.rows.slice(1).some((r) => r[2] === '3-B'),
    'journal plain: class 3-B intact'
  )
  expect(
    file.rows
      .slice(1)
      .map((r) => r[0] + r[1])
      .join() ===
      file.rows
        .slice(1)
        .map((r) => r[0] + r[1])
        .sort()
        .join(),
    'journal plain: chronological order'
  )
  const options = (await saveOptions(app))[0]
  checkFileName(options, 'journal', SCHOOL_YEAR_DATE, 'journal plain')
  noTempFiles(out, 'journal plain')

  // 2. Journal with names (hostile cells)
  const named = join(out, 'journal-names.csv')
  await goStatistics(page)
  await chooseSchoolYear(page)
  dialog = await exportKind(page, app, named, 'journal', { names: true })
  expect(
    (await dialog.getByRole('note').count()) === 1,
    'journal names: the personal-data warning is shown'
  )
  await finishExport(page, dialog, countLabel(rowsExpected.length), 'journal names')
  file = readCsv(named, 'journal names')
  same(file.rows[0], HEADERS.journalNames, 'journal names: header')
  same(
    sortedRows(file.rows.slice(1)),
    sortedRows(journalRows(SCHOOL_YEAR, true)),
    'journal names: rows (guards, quotes, newline, anonymized)'
  )
  expect(
    file.text.includes(`"${names('quote').prenom.replaceAll('"', '""')}"`),
    'journal names: quote and separator are escaped'
  )
  const newlineRow = file.rows.find((r) => r[4] === names('newline').nom)
  expect(
    newlineRow !== undefined && newlineRow.length === 7,
    'journal names: newline stays in one cell'
  )
  const anonymousRows = file.rows.filter((r) => r[4] === LABELS.anonymized)
  expect(
    anonymousRows.length === 1 && anonymousRows[0][5] === '' && anonymousRows[0][6] === '',
    'journal names: anonymized visit has the label and empty INE'
  )
  expect(
    !file.text.includes(names(ANONYMIZED).nom) && !file.text.includes(names(ANONYMIZED).ine),
    'journal names: the leaver identity is gone from the file'
  )
  expect(
    file.rows.some((r) => r[4] === guarded(names('formula').nom) && r[6] === guarded('+123')),
    "journal names: =cmd|x and +123 are prefixed with '"
  )
  expect(
    file.rows.some((r) => r[4] === guarded(names('spaced').nom)),
    "journal names: the leading-space formula is prefixed with '"
  )
  checkFileName((await saveOptions(app))[0], 'journal', SCHOOL_YEAR_DATE, 'journal names')
  noTempFiles(out, 'journal names')

  // 3. Double click: one dialog, one write
  const once = join(out, 'journal-once.csv')
  await goStatistics(page)
  await chooseSchoolYear(page)
  dialog = await exportKind(page, app, once, 'journal')
  await confirmButton(dialog).dblclick()
  await waitToast(page, countLabel(rowsExpected.length), 'double click')
  await settle(page)
  expect((await saveOptions(app)).length === 1, 'double click: the save dialog opened once')
  same(
    sortedRows(readCsv(once, 'double click').rows.slice(1)),
    sortedRows(rowsExpected),
    'double click: rows written once'
  )
  noTempFiles(out, 'double click')
}

const scenarioAggregated = async (page, app, out) => {
  const range = SCHOOL_YEAR
  const visits = visitsIn(range)
  const expectations = {
    visitsByDay: expectedPairs(countBy(visits, (v) => v.day)),
    visitsByActivity: expectedPairs(countBy(visits, (v) => ACTIVITY_LABELS[v.activity])),
    visitsByClass: expectedPairs(countBy(visits, (v) => classOf(v.who)))
  }
  for (const kind of ['visitsByDay', 'visitsByActivity', 'visitsByClass']) {
    const target = join(out, `${kind}.csv`)
    await goStatistics(page)
    await chooseSchoolYear(page)
    // Names ticked on the journal first, then the kind is switched
    const dialog = await exportKind(page, app, target, kind, {
      names: true,
      then: async () => {}
    })
    const checkbox = dialog.getByRole('checkbox', { name: LABELS.names })
    expect(await checkbox.isDisabled(), `${kind}: the names box is disabled after switching`)
    expect(!(await checkbox.isChecked()), `${kind}: the names box is unchecked after switching`)
    expect((await dialog.getByRole('note').count()) === 0, `${kind}: no names warning left`)
    await finishExport(page, dialog, countLabel(expectations[kind].length), kind)
    const file = readCsv(target, kind)
    same(file.rows[0], HEADERS[kind], `${kind}: header`)
    same(nonZeroRows(file.rows), expectations[kind], `${kind}: rows`)
    expect(
      !personalNeedles().some((needle) => file.text.includes(needle)) &&
        !file.text.includes(LABELS.anonymized),
      `${kind}: no name, INE or anonymized label in the file`
    )
    checkFileName((await saveOptions(app))[0], kind, SCHOOL_YEAR_DATE, kind)
  }
  noTempFiles(out, 'aggregated')

  // The guarantee holds server-side too: includeNames:true on an aggregated kind adds no name.
  const direct = join(out, 'direct-aggregated.csv')
  await stubSave(app, direct)
  const result = await callRaw(page, 'export.run', {
    kind: 'visitsByClass',
    period: range,
    includeNames: true
  })
  expect(result.success === true, 'IPC aggregated with includeNames true: accepted')
  const file = readCsv(direct, 'IPC aggregated')
  same(file.rows[0], HEADERS.visitsByClass, 'IPC aggregated: header')
  expect(
    !personalNeedles().some((needle) => file.text.includes(needle)),
    'IPC aggregated: includeNames true still exports no name'
  )
  const refused = await callRaw(page, 'export.run', { kind: 'students', includeNames: true })
  expect(
    refused.success === false,
    'IPC students without acknowledgement is refused by the main process'
  )
}

const scenarioCancelAndErrors = async (page, app, out) => {
  // Cancelled native dialog: no file, no .tmp, no toast, dialog closed
  const cancelled = join(out, 'cancelled.csv')
  await goStatistics(page)
  await chooseSchoolYear(page)
  await stubSave(app, null)
  let dialog = await openStatisticsDialog(page)
  await confirmButton(dialog).click()
  await waitHidden(dialog, 'cancel: dialog')
  await settle(page, QUIET_MS)
  expect((await saveOptions(app)).length === 1, 'cancel: the save dialog was opened')
  expect(!existsSync(cancelled), 'cancel: no file')
  noTempFiles(out, 'cancel')
  expect((await page.getByRole('alert').count()) === 0, 'cancel: no toast and no error')

  // Unwritable target: error text in the dialog, nothing written, then a retry succeeds
  const missing = join(out, 'missing-dir', 'x.csv')
  await goStatistics(page)
  await chooseSchoolYear(page)
  await stubSave(app, missing)
  dialog = await openStatisticsDialog(page)
  await confirmButton(dialog).click()
  const alert = dialog.getByRole('alert')
  try {
    await alert.waitFor({ timeout: UI_TIMEOUT_MS })
    expect(
      (await alert.innerText()).includes(LABELS.writeFailed),
      `unwritable: error text mentions the failure (got "${await alert.innerText()}")`
    )
  } catch {
    offenders.push('unwritable: no error shown in the dialog')
  }
  expect(await dialog.isVisible(), 'unwritable: the dialog stays open')
  expect(
    (await page.getByRole('alert').count()) === 1,
    'unwritable: the error is not duplicated in a toast'
  )
  expect(
    !existsSync(missing) && !existsSync(join(out, 'missing-dir')),
    'unwritable: nothing created'
  )
  noTempFiles(out, 'unwritable')
  const retry = join(out, 'retry.csv')
  await stubSave(app, retry)
  await confirmButton(dialog).click()
  await waitToast(page, countLabel(journalRows(SCHOOL_YEAR, false).length), 'retry after failure')
  expect(existsSync(retry), 'retry after failure: the file is written')

  // Replacing an existing file (the OS dialog already confirmed the overwrite)
  const existing = join(out, 'existing.csv')
  writeFileSync(existing, 'OLD CONTENT')
  await goStatistics(page)
  await chooseSchoolYear(page)
  dialog = await exportKind(page, app, existing, 'visitsByDay')
  await finishExport(page, dialog, /lignes? exportées?/, 'overwrite')
  expect(
    !readFileSync(existing, 'utf8').includes('OLD CONTENT'),
    'overwrite: the old file is replaced'
  )
  noTempFiles(out, 'overwrite')
}

const scenarioPeriods = async (page, app, out) => {
  // Custom range: only the rows of that range, and the range is in the file name
  const custom = join(out, 'custom.csv')
  await goStatistics(page)
  await chooseCustom(page, CUSTOM_RANGE)
  let dialog = await exportKind(page, app, custom, 'journal')
  const expectedRows = journalRows(CUSTOM_RANGE, false)
  expect(expectedRows.length === 1, 'seed: exactly one visit in the custom range')
  await finishExport(page, dialog, countLabel(expectedRows.length), 'custom range')
  const file = readCsv(custom, 'custom range')
  same(file.rows.slice(1), expectedRows, 'custom range: only the visit of that range')
  checkFileName(
    (await saveOptions(app))[0],
    'journal',
    `${CUSTOM_RANGE.startDate}_${CUSTOM_RANGE.endDate}`,
    'custom range'
  )

  // Empty period: BOM + header only, "0 ligne exportée"
  for (const kind of ['journal', 'visitsByDay']) {
    const empty = join(out, `empty-${kind}.csv`)
    await goStatistics(page)
    await chooseCustom(page, EMPTY_RANGE)
    dialog = await exportKind(page, app, empty, kind)
    await finishExport(page, dialog, countLabel(0), `empty ${kind}`)
    const bytes = readFileSync(empty)
    const header = Buffer.concat([
      Buffer.from(BOM),
      Buffer.from(`${HEADERS[kind].join(';')}\r\n`, 'utf8')
    ])
    expect(bytes.equals(header), `empty ${kind}: the file is exactly BOM + header`)
  }
}

const scenarioStudents = async (page, app, out) => {
  const target = join(out, 'students.csv')
  await goStudents(page)
  await stubSave(app, target)
  await studentsTrigger(page).click()
  const dialog = studentsDialog(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  expect(
    await confirmButton(dialog).isDisabled(),
    'students: Exporter is disabled until acknowledged'
  )
  await confirmButton(dialog)
    .click({ force: true })
    .catch(() => {})
  await settle(page)
  expect(
    (await saveOptions(app)).length === 0,
    'students: nothing happens without the acknowledgement'
  )
  await dialog.getByRole('checkbox', { name: LABELS.acknowledge }).check()
  expect(await confirmButton(dialog).isEnabled(), 'students: Exporter is enabled once acknowledged')
  const present = Object.keys(STUDENTS).filter((who) => who !== ANONYMIZED)
  await finishExport(page, dialog, countLabel(present.length), 'students')

  const file = readCsv(target, 'students')
  same(file.rows[0], HEADERS.students, 'students: header')
  const visitCount = (who) => String(VISITS.filter((v) => v.who === who).length)
  const expected = present.map((who) => {
    const s = names(who)
    return [safeCell(s.nom), safeCell(s.prenom), classOf(who), safeCell(s.ine), visitCount(who)]
  })
  same(
    sortedRows(file.rows.slice(1)),
    sortedRows(expected),
    'students: rows with their visit counts'
  )
  const total = file.rows.slice(1).reduce((sum, r) => sum + Number(r[4]), 0)
  expect(
    total === VISITS.filter((v) => v.who !== ANONYMIZED).length,
    `students: anonymized visits are not counted (sum ${total})`
  )
  expect(
    !file.text.includes(names(ANONYMIZED).nom) && !file.text.includes(names(ANONYMIZED).ine),
    'students: the anonymized student is not exported'
  )
  expect(
    file.rows.some((r) => r[2] === '3-B'),
    'students: class 3-B intact'
  )
  checkFileName((await saveOptions(app))[0], 'students', todayIso, 'students')
  noTempFiles(out, 'students')
}

const scenarioAccessibility = async (page, app, out) => {
  await goStatistics(page)
  await stubSave(app, join(out, 'a11y.csv'))
  const trigger = statisticsTrigger(page)
  await trigger.focus()
  await trigger.press('Enter')
  const dialog = statisticsDialog(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  expect(
    (await dialog.getByRole('radiogroup', { name: LABELS.legend }).count()) === 1,
    'a11y: the radiogroup has an accessible name'
  )
  expect(
    (await dialog.getByRole('checkbox', { name: LABELS.names }).count()) === 1,
    'a11y: the names checkbox has an accessible name'
  )
  expect(
    (await activeDescription(page))?.text === LABELS.cancel,
    'a11y: the initial focus is the safe action Annuler'
  )
  let reached = false
  for (let i = 0; i < TAB_LIMIT && !reached; i += 1) {
    await page.keyboard.press('Tab')
    const active = await activeDescription(page)
    reached = active?.tag === 'BUTTON' && active.text === LABELS.confirm
  }
  expect(reached, `a11y: Tab reaches Exporter within ${TAB_LIMIT} presses`)
  await page.keyboard.press('Escape')
  await waitHidden(dialog, 'a11y: dialog (Escape)')
  await settle(page)
  const back = await activeDescription(page)
  expect(
    back?.tag === 'BUTTON' && back.text.endsWith(LABELS.statisticsTrigger),
    `a11y: focus returns to the Exporter button after Escape (got ${JSON.stringify(back)})`
  )
  expect((await saveOptions(app)).length === 0, 'a11y: Escape exported nothing')

  await goStudents(page)
  await studentsTrigger(page).click()
  const students = studentsDialog(page)
  await students.waitFor({ timeout: UI_TIMEOUT_MS })
  await students.getByRole('button', { name: LABELS.cancel }).click()
  await waitHidden(students, 'a11y: students dialog (Annuler)')
  await settle(page)
  const backStudents = await activeDescription(page)
  expect(
    backStudents?.text.endsWith(LABELS.studentsTrigger),
    `a11y: focus returns to Exporter la liste after Annuler (got ${JSON.stringify(backStudents)})`
  )
}

const scenarioLayout = async (page, app, label) => {
  await goStatistics(page)
  await checkToolbar(page, LABELS.statisticsTrigger, `${label} statistics toolbar`)
  let dialog = await openStatisticsDialog(page)
  await settle(page)
  await checkDialog(page, `${label} statistics dialog`)
  await dialog.getByRole('button', { name: LABELS.cancel }).click()
  await waitHidden(dialog, `${label}: statistics dialog`)

  await goStudents(page)
  await checkToolbar(page, LABELS.studentsTrigger, `${label} students toolbar`)
  await studentsTrigger(page).click()
  dialog = studentsDialog(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  await settle(page)
  await checkDialog(page, `${label} students dialog`)
  await dialog.getByRole('button', { name: LABELS.cancel }).click()
  await waitHidden(dialog, `${label}: students dialog`)
}

const tmp = mkdtempSync(join(tmpdir(), 'check-export-'))
const userData = join(tmp, 'userData')
const out = join(tmp, 'out')
mkdirSync(userData, { recursive: true })
mkdirSync(out, { recursive: true })

let app
try {
  let page
  ;({ app, page } = await launch(userData))
  await seed(page)
  checkSeedStored()
  await scenarioJournal(page, app, out)
  await scenarioAggregated(page, app, out)
  await scenarioCancelAndErrors(page, app, out)
  await scenarioPeriods(page, app, out)
  await scenarioStudents(page, app, out)
  await scenarioAccessibility(page, app, out)

  await resizeTo(app, SMALL_VIEWPORT)
  await scenarioLayout(page, app, 'light 800x600')
  await call(page, 'settings.setTheme', { accent: 'purple', mode: 'dark' })
  await scenarioLayout(page, app, 'dark 800x600')
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(background !== 'rgb(255, 255, 255)', `dark mode is really applied (body ${background})`)
} catch (error) {
  offenders.push(`script error: ${error instanceof Error ? error.stack : String(error)}`)
} finally {
  if (app) {
    await closeQuietly(app)
  }
  rmSync(tmp, { recursive: true, force: true })
  alignAbi('node')
}

if (offenders.length > 0) {
  console.error(`Export check FAILED (${offenders.length}):`)
  for (const o of offenders) {
    console.error(' - ' + o)
  }
  process.exit(EXIT_FAIL)
}
console.log('ALL EXPORT CHECKS PASSED')
