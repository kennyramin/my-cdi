#!/usr/bin/env node
// Electron end-to-end check of the duplicate-visit warning and of editing a journal entry
// (not part of vitest). Launches the built app on a throwaway --user-data-dir, drives the real UI
// and reads results back through window.electronAPI. Exit code 0 = pass, 1 = failures printed,
// 2 = cannot run now (too early in the day to seed visits before "now" on the same day).
//
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright [AXE_SOURCE=/path/to/axe.min.js] \
//          TZ=Europe/Paris xvfb-run -a npm run check:duplicates
//   - PLAYWRIGHT_MODULE is required: playwright is not a project dependency, point it at an install.
//   - AXE_SOURCE is optional: without it the axe pass is skipped with a notice (axe-core is not a
//     project dependency either).
//   - check:duplicates aligns better-sqlite3 to the ELECTRON ABI for the run; this script aligns it
//     back to the NODE ABI when it ends so vitest keeps working.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const root = fileURLToPath(new URL('..', import.meta.url))
const ELECTRON_BIN = join(root, 'node_modules/electron/dist/electron')

const READY_TIMEOUT_MS = 15000
const UI_TIMEOUT_MS = 8000
const POLL_MS = 100
const SETTLE_MS = 400
const ERROR_EXCERPT = 300
const EXIT_FAIL = 1
const EXIT_CANNOT_RUN = 2
const MIN_MINUTES_SINCE_MIDNIGHT = 100
const MS_PER_MINUTE = 60000
const SMALL_VIEWPORT = { w: 800, h: 600 }
const SUBPIXEL_TOLERANCE = 1
const ACTIVITY = 'work'
const UPDATE_CHANNEL = 'frequentation.update'
const CREATE_BATCH_CHANNEL = 'frequentation.createBatch'
const DIALOG_TITLE = 'Présence déjà enregistrée'
const CONFIRM_LABEL = 'Enregistrer quand même'
const SUBMIT_LABEL = 'Enregistrer'
const ANONYMIZED_LABEL = 'Élève anonymisé'
const CONCURRENT_ROUNDS = 3
const CONCURRENT_CALLS = 3

const student = (nom, prenom, classe, index) => ({
  nom,
  prenom,
  classe,
  ine: `DU${String(index).padStart(8, '0')}Z`
})
const ALPHARD = student('Alphard', 'Ana', '3A', 1)
const BELLATRIX = student('Bellatrix', 'Ben', '3B', 2)
const CAPELLA = student('Capella', 'Cleo', '3C', 3)
const DENEB = student('Deneb', 'Dan', '3D', 4)
const ELECTRA = student('Electra', 'Eva', '3E', 5)
const GACRUX = student('Gacrux', 'Gus', '3G', 6)
const HADAR = student('Hadar', 'Hana', '6H', 7)
const LAYSAN = student('Laysan', 'Lou', '4L', 8)
const CONCURRENT = Array.from({ length: CONCURRENT_ROUNDS }, (_, i) =>
  student(`Fomalhaut${String.fromCharCode(97 + i)}`, 'Fay', '5F', 20 + i)
)

const alignAbi = (runtime) =>
  spawnSync(
    process.execPath,
    [join(root, 'scripts/align-better-sqlite3-abi.mjs'), `--runtime=${runtime}`],
    { cwd: root, stdio: 'inherit' }
  )

const offenders = []
const expect = (ok, what) => {
  if (!ok) {
    offenders.push(what)
  }
}

const pad = (n) => String(n).padStart(2, '0')
const localDay = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const localTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const localIso = (date) => `${localDay(date)}T${localTime(date)}:00`

const now = new Date()
const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
if (minutesSinceMidnight < MIN_MINUTES_SINCE_MIDNIGHT) {
  console.error('Too early in the day to seed visits before now: retry in a few minutes')
  process.exit(EXIT_CANNOT_RUN)
}
const base = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate(),
  now.getHours(),
  now.getMinutes()
)
const minutesAgo = (n) => new Date(base.getTime() - n * MS_PER_MINUTE)
const today = localDay(base)
const yesterday = (() => {
  const d = new Date(base)
  d.setDate(d.getDate() - 1)
  return d
})()
const tomorrow = (() => {
  const d = new Date(base)
  d.setDate(d.getDate() + 1)
  return d
})()

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

// Same as call() but returns the raw IpcResult so refusals can be asserted.
const callRaw = (page, path, input) =>
  page.evaluate(
    async ({ p, i }) => {
      const [group, method] = p.split('.')
      return window.electronAPI[group][method](i)
    },
    { p: path, i: input }
  )

const createStudent = async (page, s) => (await call(page, 'student.create', s)).id

const seedVisit = (page, studentId, startsAt) =>
  call(page, 'frequentation.createBatch', {
    frequentations: [{ startsAt, activity: ACTIVITY, studentId }]
  })

const entriesOn = (page, day) =>
  call(page, 'frequentation.getJournalEntries', { startDate: day, endDate: day })

const allEntries = async (page) => {
  const out = []
  for (const day of [localDay(yesterday), today]) {
    out.push(...(await entriesOn(page, day)))
  }
  return out
}

const entriesOfStudent = async (page, studentId) =>
  (await allEntries(page)).filter((e) => e.frequentation.studentId === studentId)

const until = async (check, what) => {
  const deadline = Date.now() + UI_TIMEOUT_MS
  let last
  while (Date.now() < deadline) {
    last = await check()
    if (last) {
      return last
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  offenders.push(`timeout waiting for: ${what}`)
  return null
}

const settle = (page) => page.waitForTimeout(SETTLE_MS)

const goJournal = async (page) => {
  await page.evaluate(() => {
    window.location.hash = '#/'
  })
  await page.reload()
  await page.waitForSelector('main form button[type="submit"]', { timeout: UI_TIMEOUT_MS })
}

const submitButton = (page) => page.locator('main form button[type="submit"]')
const warningDialog = (page) => page.getByRole('dialog', { name: DIALOG_TITLE })
// Role queries skip a dialog hidden from the a11y tree while another modal is on top of it.
const editDialogAnyState = (page) =>
  page.locator('[role="dialog"]').filter({ hasText: "Modifier l'entrée" })
const editDialog = (page) => page.getByRole('dialog', { name: "Modifier l'entrée" })

const selectStudent = async (page, s) => {
  const input = page.locator('main form input[role="combobox"]')
  await input.fill(s.nom)
  await page.getByRole('option', { name: new RegExp(s.nom) }).click()
}

const describeActive = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return el
      ? { tag: el.tagName, type: el.getAttribute('type'), text: (el.textContent ?? '').trim() }
      : null
  })

const waitHidden = async (locator, what) => {
  try {
    await locator.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS })
  } catch {
    offenders.push(`${what} did not close`)
  }
}

const rowOf = (page, s, time) =>
  page.locator('main ul li', { hasText: s.nom }).filter({ hasText: time })

const openEdit = async (page, s, entry) => {
  const time = entry.frequentation.startsAt.slice(11, 16)
  await rowOf(page, s, time).getByRole('button', { name: 'Modifier', exact: true }).click()
  await editDialog(page).waitFor({ timeout: UI_TIMEOUT_MS })
}

const fillEditTime = (page, time) => editDialog(page).getByLabel('Heure').fill(time)
const fillEditDate = (page, date) => editDialog(page).getByLabel('Date', { exact: true }).fill(date)
const saveEdit = (page) => editDialog(page).getByRole('button', { name: SUBMIT_LABEL }).click()

const pickEditStudent = async (page, s) => {
  const combo = editDialog(page).getByRole('combobox', { name: 'Élève' })
  await combo.fill(s.nom)
  await page.getByRole('option', { name: new RegExp(s.nom) }).click()
}

const recordIpc = (app, channels) =>
  app.evaluate(({ ipcMain }, list) => {
    globalThis.__ipcCalls = []
    for (const channel of list) {
      const original = ipcMain._invokeHandlers.get(channel)
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, (event, ...args) => {
        globalThis.__ipcCalls.push({ channel, input: args[0] })
        return original(event, ...args)
      })
    }
  }, channels)

const takeIpcCalls = (app, channel) =>
  app.evaluate(({ ipcMain }, ch) => {
    void ipcMain
    const taken = globalThis.__ipcCalls.filter((c) => c.channel === ch)
    globalThis.__ipcCalls = globalThis.__ipcCalls.filter((c) => c.channel !== ch)
    return taken
  }, channel)

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

// The dialog sits inside the viewport, does not scroll sideways, and its buttons are reachable:
// fully visible and not covered by anything outside the dialog (e.g. the sticky submit bar).
const checkDialogLayout = async (page, label) => {
  const report = await page.evaluate(
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
        problems.push(`dialog scrolls sideways (${dialog.scrollWidth} > ${dialog.clientWidth})`)
      }
      const doc = document.documentElement
      if (doc.scrollWidth > doc.clientWidth + tolerance) {
        problems.push('page scrolls horizontally')
      }
      for (const button of dialog.querySelectorAll('button')) {
        const r = button.getBoundingClientRect()
        if (!inside(r)) {
          problems.push(`button "${button.textContent}" leaves the viewport`)
        }
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!hit || !dialog.contains(hit)) {
          problems.push(`button "${button.textContent}" is covered by another element`)
        }
      }
      return problems
    },
    { tolerance: SUBPIXEL_TOLERANCE }
  )
  for (const problem of report) {
    offenders.push(`${label}: ${problem}`)
  }
  const violations = await axeViolations(page)
  expect(violations.length === 0, `${label}: axe violations ${violations.join(', ')}`)
}

const resizeTo = (app, size) =>
  app.evaluate(
    ({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h),
    size
  )

const cancelWarning = async (page) => {
  await warningDialog(page).getByRole('button', { name: 'Annuler' }).click()
  await waitHidden(warningDialog(page), 'warning dialog (cancel)')
}

// Opens the create warning, the edit dialog and the warning over the edit dialog for LAYSAN
// (visits at now-8 and now-60) and checks layout + axe for each. Everything is cancelled.
const exerciseDialogs = async (page, label, laysan) => {
  await goJournal(page)
  await selectStudent(page, LAYSAN)
  await submitButton(page).click()
  await warningDialog(page).waitFor({ timeout: UI_TIMEOUT_MS })
  await settle(page)
  await checkDialogLayout(page, `${label} create warning`)
  await cancelWarning(page)

  const earlier = laysan.find((e) => e.frequentation.startsAt === localIso(minutesAgo(60)))
  await openEdit(page, LAYSAN, earlier)
  await settle(page)
  await checkDialogLayout(page, `${label} edit dialog`)
  await fillEditTime(page, localTime(minutesAgo(9)))
  await saveEdit(page)
  await warningDialog(page).waitFor({ timeout: UI_TIMEOUT_MS })
  await settle(page)
  await checkDialogLayout(page, `${label} edit warning`)
  await cancelWarning(page)
  await editDialog(page).getByRole('button', { name: 'Annuler' }).click()
  await waitHidden(editDialog(page), `${label} edit dialog`)
}

const tmp = mkdtempSync(join(tmpdir(), 'check-duplicates-'))
const userData = join(tmp, 'userData')
mkdirSync(userData, { recursive: true })

let app
try {
  let page
  ;({ app, page } = await launch(userData))
  const ids = {}
  for (const s of [
    ALPHARD,
    BELLATRIX,
    CAPELLA,
    DENEB,
    ELECTRA,
    GACRUX,
    HADAR,
    LAYSAN,
    ...CONCURRENT
  ]) {
    ids[s.nom] = await createStudent(page, s)
  }
  await seedVisit(page, ids.Alphard, localIso(minutesAgo(10)))
  await seedVisit(page, ids.Bellatrix, localIso(minutesAgo(45)))
  await seedVisit(page, ids.Capella, localIso(yesterday))
  await seedVisit(page, ids.Deneb, localIso(minutesAgo(5)))
  await seedVisit(page, ids.Gacrux, localIso(minutesAgo(90)))
  await seedVisit(page, ids.Laysan, localIso(minutesAgo(8)))
  await seedVisit(page, ids.Laysan, localIso(minutesAgo(60)))
  await recordIpc(app, [UPDATE_CHANNEL, CREATE_BATCH_CHANNEL])

  // 1. Same student within 30 min: warning lists the existing visit, nothing written yet
  await goJournal(page)
  await selectStudent(page, ALPHARD)
  await submitButton(page).click()
  const dialog = warningDialog(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  const dialogText = await dialog.innerText()
  expect(
    dialogText.includes(localTime(minutesAgo(10))) && dialogText.includes('Ana Alphard'),
    `1: warning lists the existing visit (got "${dialogText.slice(0, ERROR_EXCERPT)}")`
  )
  expect(
    (await entriesOfStudent(page, ids.Alphard)).length === 1,
    '1: nothing written while the warning is open'
  )

  // 2. Annuler: dialog closes, selection kept, focus back on the submit button, nothing written
  await cancelWarning(page)
  await settle(page)
  const focus = await describeActive(page)
  expect(
    focus?.tag === 'BUTTON' && focus.type === 'submit' && focus.text.includes(SUBMIT_LABEL),
    `2: focus returns to the Enregistrer button (got ${JSON.stringify(focus)})`
  )
  expect(
    (await page.locator('main form').innerText()).includes('Ana Alphard'),
    '2: the student is still selected after Annuler'
  )
  expect((await entriesOfStudent(page, ids.Alphard)).length === 1, '2: Annuler wrote nothing')

  // 3. Enregistrer quand même, double click: exactly one extra visit, one resend with allowDuplicates
  await takeIpcCalls(app, CREATE_BATCH_CHANNEL)
  await submitButton(page).click()
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  await dialog.getByRole('button', { name: CONFIRM_LABEL }).dblclick()
  await waitHidden(dialog, '3: warning dialog (confirm)')
  await until(
    async () => (await entriesOfStudent(page, ids.Alphard)).length >= 2,
    '3: the visit is written after confirmation'
  )
  await settle(page)
  expect(
    (await entriesOfStudent(page, ids.Alphard)).length === 2,
    '3: exactly one visit written even on double click'
  )
  const createCalls = await takeIpcCalls(app, CREATE_BATCH_CHANNEL)
  expect(
    createCalls.length === 2 &&
      createCalls[0].input.allowDuplicates === undefined &&
      createCalls[1].input.allowDuplicates === true,
    `3: one plain call then exactly one resend with allowDuplicates (got ${JSON.stringify(createCalls.map((c) => c.input.allowDuplicates))})`
  )

  // 4. 31+ minutes apart and different days: no warning
  for (const [s, what] of [
    [BELLATRIX, '4: 45 minutes apart'],
    [CAPELLA, '4: previous day']
  ]) {
    await goJournal(page)
    await selectStudent(page, s)
    await submitButton(page).click()
    await until(async () => (await entriesOfStudent(page, ids[s.nom])).length === 2, what)
    expect((await warningDialog(page).count()) === 0, `${what}: no warning dialog`)
  }

  // 5. Batch with two students, one duplicate: nothing written until confirmed
  await goJournal(page)
  await selectStudent(page, DENEB)
  await selectStudent(page, ELECTRA)
  await submitButton(page).click()
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  const batchText = await dialog.innerText()
  expect(
    batchText.includes('Dan Deneb') && !batchText.includes('Eva Electra'),
    `5: only the duplicate student is listed (got "${batchText.slice(0, ERROR_EXCERPT)}")`
  )
  expect(
    (await entriesOfStudent(page, ids.Electra)).length === 0 &&
      (await entriesOfStudent(page, ids.Deneb)).length === 1,
    '5: nothing written for either student until confirmed'
  )
  await dialog.getByRole('button', { name: CONFIRM_LABEL }).click()
  await until(
    async () =>
      (await entriesOfStudent(page, ids.Electra)).length === 1 &&
      (await entriesOfStudent(page, ids.Deneb)).length === 2,
    '5: both students written after confirmation'
  )

  // 6. Concurrent creations of the same visit: a single one is written without confirmation
  for (const s of CONCURRENT) {
    const startsAt = localIso(minutesAgo(20))
    const results = await page.evaluate(
      async ({ dto, calls }) =>
        Promise.all(
          Array.from({ length: calls }, () => window.electronAPI.frequentation.createBatch(dto))
        ),
      {
        dto: { frequentations: [{ startsAt, activity: ACTIVITY, studentId: ids[s.nom] }] },
        calls: CONCURRENT_CALLS
      }
    )
    const written = results.filter((r) => r.success && r.data.created === 1).length
    const warned = results.filter(
      (r) => r.success && r.data.created === 0 && r.data.duplicates
    ).length
    expect(
      written === 1 && warned === CONCURRENT_CALLS - 1,
      `6: ${s.nom}: one write and ${CONCURRENT_CALLS - 1} warnings (got ${written}/${warned})`
    )
    expect(
      (await entriesOfStudent(page, ids[s.nom])).length === 1,
      `6: ${s.nom}: exactly one visit stored`
    )
  }

  // 7. Edit the time of an entry through the dialog (changed-only payload, then persisted)
  await goJournal(page)
  const alphardNew = (await entriesOfStudent(page, ids.Alphard)).find(
    (e) => e.frequentation.startsAt !== localIso(minutesAgo(10))
  )
  const entryId = alphardNew.frequentation.id
  await takeIpcCalls(app, UPDATE_CHANNEL)
  await openEdit(page, ALPHARD, alphardNew)
  const newTime = localTime(minutesAgo(50))
  await fillEditTime(page, newTime)
  await saveEdit(page)
  await waitHidden(editDialog(page), '7: edit dialog (time)')
  const afterTime = (await entriesOfStudent(page, ids.Alphard)).find(
    (e) => e.frequentation.id === entryId
  )
  expect(
    afterTime?.frequentation.startsAt === localIso(minutesAgo(50)),
    `7: new startsAt persisted (got ${afterTime?.frequentation.startsAt})`
  )
  const [timeCall] = await takeIpcCalls(app, UPDATE_CHANNEL)
  expect(
    timeCall && Object.keys(timeCall.input).sort().join(',') === 'activity,id,startsAt',
    `7: payload carries only the changed fields (got ${JSON.stringify(timeCall?.input)})`
  )

  // 8. Edit the student through the dialog: snapshot class follows
  await goJournal(page)
  await takeIpcCalls(app, UPDATE_CHANNEL)
  await openEdit(page, ALPHARD, afterTime)
  await pickEditStudent(page, HADAR)
  await saveEdit(page)
  await waitHidden(editDialog(page), '8: edit dialog (student)')
  const afterStudent = (await entriesOfStudent(page, ids.Hadar))[0]
  expect(
    afterStudent?.frequentation.id === entryId &&
      afterStudent.frequentation.studentClass === HADAR.classe &&
      afterStudent.frequentation.startsAt === localIso(minutesAgo(50)),
    `8: entry moved to Hadar with her class and unchanged time (got ${JSON.stringify(afterStudent?.frequentation)})`
  )
  const [studentCall] = await takeIpcCalls(app, UPDATE_CHANNEL)
  expect(
    studentCall && Object.keys(studentCall.input).sort().join(',') === 'activity,id,studentId',
    `8: payload carries studentId but not startsAt (got ${JSON.stringify(studentCall?.input)})`
  )

  // 9. Edit creating a duplicate: warning over the edit dialog; cancel keeps it open and unchanged
  await goJournal(page)
  await takeIpcCalls(app, UPDATE_CHANNEL)
  await openEdit(page, HADAR, afterStudent)
  await pickEditStudent(page, BELLATRIX)
  await saveEdit(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  expect(
    (await dialog.innerText()).includes(localTime(minutesAgo(45))),
    '9: the warning lists Bellatrix visit at now-45'
  )
  expect(
    await editDialogAnyState(page).isVisible(),
    '9: the edit dialog stays open under the warning'
  )
  await cancelWarning(page)
  await settle(page)
  expect(await editDialog(page).isVisible(), '9: the edit dialog is still open after Annuler')
  const editFocus = await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"]')?.textContent ?? ''
  )
  expect(
    editFocus.includes("Modifier l'entrée"),
    `9: focus stays inside the edit dialog after Annuler (got "${editFocus.slice(0, 40)}")`
  )
  expect((await entriesOfStudent(page, ids.Hadar)).length === 1, '9: nothing changed after Annuler')
  await saveEdit(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  await dialog.getByRole('button', { name: CONFIRM_LABEL }).click()
  await waitHidden(editDialog(page), '9: edit dialog (confirmed)')
  const afterDuplicate = (await entriesOfStudent(page, ids.Bellatrix)).find(
    (e) => e.frequentation.id === entryId
  )
  expect(afterDuplicate !== undefined, '9: the entry moved to Bellatrix after confirmation')
  const duplicateCalls = await takeIpcCalls(app, UPDATE_CHANNEL)
  expect(
    duplicateCalls.length === 3 &&
      duplicateCalls[0].input.allowDuplicates === undefined &&
      duplicateCalls[2].input.allowDuplicates === true,
    `9: edit resent once with allowDuplicates (got ${JSON.stringify(duplicateCalls.map((c) => c.input.allowDuplicates))})`
  )

  // 10. Future time refused in the dialog and by the backend
  await goJournal(page)
  await takeIpcCalls(app, UPDATE_CHANNEL)
  await openEdit(page, BELLATRIX, afterDuplicate)
  await fillEditDate(page, localDay(tomorrow))
  await settle(page)
  expect(
    await editDialog(page).getByRole('button', { name: SUBMIT_LABEL }).isDisabled(),
    '10: Enregistrer is disabled for a future date'
  )
  expect(
    (await editDialog(page).innerText()).includes('futur') ||
      (await editDialog(page).innerText()).includes('passé'),
    '10: the dialog explains why (future refused)'
  )
  await editDialog(page).getByRole('button', { name: 'Annuler' }).click()
  await waitHidden(editDialog(page), '10: edit dialog')
  expect((await takeIpcCalls(app, UPDATE_CHANNEL)).length === 0, '10: nothing was sent')
  const refused = await callRaw(page, 'frequentation.update', {
    id: entryId,
    startsAt: localIso(tomorrow)
  })
  expect(refused.success === false, '10: the backend refuses a future startsAt')

  // 11. Anonymized visit: student locked, time still editable
  await call(page, 'student.anonymize', { ids: [ids.Gacrux] })
  await goJournal(page)
  const gacruxEntry = (await allEntries(page)).find((e) => e.student === null)
  await takeIpcCalls(app, UPDATE_CHANNEL)
  await openEdit(page, { nom: ANONYMIZED_LABEL }, gacruxEntry)
  const studentCombo = editDialog(page).getByRole('combobox', { name: 'Élève' })
  expect(await studentCombo.isDisabled(), '11: the student field is locked for an anonymized visit')
  expect(
    (await editDialog(page).innerText()).includes('ne peut pas être réassocié'),
    '11: the dialog explains the lock'
  )
  await fillEditTime(page, localTime(minutesAgo(80)))
  await saveEdit(page)
  await waitHidden(editDialog(page), '11: edit dialog')
  const gacruxAfter = (await allEntries(page)).find(
    (e) => e.frequentation.id === gacruxEntry.frequentation.id
  )
  expect(
    gacruxAfter.student === null && gacruxAfter.frequentation.startsAt === localIso(minutesAgo(80)),
    '11: the anonymized visit moved in time and stayed anonymized'
  )
  const [anonCall] = await takeIpcCalls(app, UPDATE_CHANNEL)
  expect(
    anonCall && !('studentId' in anonCall.input),
    '11: no studentId sent for the anonymized visit'
  )

  // 12. Layout, focus and axe of the new dialogs: light/dark x 1280 default and 800x600
  const laysan = await entriesOfStudent(page, ids.Laysan)
  await exerciseDialogs(page, 'light default', laysan)
  await resizeTo(app, SMALL_VIEWPORT)
  await exerciseDialogs(page, 'light 800x600', laysan)
  await call(page, 'settings.setTheme', { accent: 'purple', mode: 'dark' })
  await exerciseDialogs(page, 'dark 800x600', laysan)
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(
    darkBackground !== 'rgb(255, 255, 255)',
    `12: dark mode is really applied (body background ${darkBackground})`
  )
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
  console.error(`Duplicates check FAILED (${offenders.length}):`)
  for (const o of offenders) {
    console.error(' - ' + o)
  }
  process.exit(EXIT_FAIL)
}
console.log('Duplicates check passed')
