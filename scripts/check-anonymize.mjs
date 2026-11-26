#!/usr/bin/env node
// Electron end-to-end check of student anonymization and CSV removal (not part of vitest).
// Launches the built app on a throwaway --user-data-dir, drives the real UI and inspects the
// database file bytes. Exit code 0 = pass, 1 = failures printed, 2 = cannot run now (too early
// in the day to seed visits strictly in the past).
//
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright xvfb-run -a npm run check:anonymize
//   - PLAYWRIGHT_MODULE is required: playwright is not a project dependency, point it at an install.
//   - check:anonymize aligns better-sqlite3 to the ELECTRON ABI for the run; this script aligns it
//     back to the NODE ABI when it ends so vitest keeps working.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSeedTimes } from './lib/buildSeedTimes.mjs'

const require = createRequire(import.meta.url)
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const root = fileURLToPath(new URL('..', import.meta.url))
const ELECTRON_BIN = join(root, 'node_modules/electron/dist/electron')

const READY_TIMEOUT_MS = 15000
const UI_TIMEOUT_MS = 8000
const PENDING_DELAY_MS = 2500
const ERROR_EXCERPT = 300
const EXIT_FAIL = 1
const EXIT_CANNOT_RUN = 2
const MIN_SEED_TIMES = 8
const PARIS_TZ = 'Europe/Paris'
const ANONYMIZE_CHANNEL = 'student.anonymize'
const ANONYMIZED_LABEL = 'Élève anonymisé'
const CONFIRM_KEYWORD = 'RETIRER'
const ACTIVITY = 'work'

const ZORGLUB = { nom: 'Zorglub', prenom: 'Marcelin', classe: '3B', ine: 'ZZ99999999Z' }
const NOVISIT = { nom: 'Sansvisite', prenom: 'Odilon', classe: '3B', ine: 'SV00000001A' }
const CONTROL = { nom: 'Controle', prenom: 'Alice', classe: '4A', ine: 'CT00000002B' }
const BATCH_ONE = { nom: 'Batchun', prenom: 'Lea', classe: '5C', ine: 'BA00000003C' }
const BATCH_TWO = { nom: 'Batchdeux', prenom: 'Tom', classe: '5C', ine: 'BB00000004D' }
const CSV_GONE = { nom: 'Csvabsent', prenom: 'Zoe', classe: '6D', ine: 'CS00000005E' }
const CSV_GONE_EMPTY = { nom: 'Csvvide', prenom: 'Ugo', classe: '6D', ine: 'CV00000006F' }
const LEAVERS = [ZORGLUB, NOVISIT, BATCH_ONE, BATCH_TWO, CSV_GONE, CSV_GONE_EMPTY]

const CSV_HEADER = 'Nom de famille;Prénom 1;INE;Division'
const csvLine = (s) => `${s.nom};${s.prenom};${s.ine};${s.classe}`

const alignAbi = (runtime) =>
  spawnSync(
    process.execPath,
    [join(root, 'scripts/align-better-sqlite3-abi.mjs'), `--runtime=${runtime}`],
    {
      cwd: root,
      stdio: 'inherit'
    }
  )

const offenders = []
const expect = (ok, what) => {
  if (!ok) {
    offenders.push(what)
  }
}

const launch = async (userDataDir, env = {}) => {
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`, root],
    env: { ...process.env, ...env }
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

const runInElectronNode = (code) => {
  const res = spawnSync(ELECTRON_BIN, ['-e', code], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    cwd: root,
    encoding: 'utf8'
  })
  if (res.status !== 0) {
    throw new Error(
      'electron-as-node failed: ' + (res.stderr || res.stdout).slice(0, ERROR_EXCERPT)
    )
  }
  return res.stdout.trim()
}

const sqliteJson = (dbPath, sql) =>
  JSON.parse(
    runInElectronNode(
      `const D=require('better-sqlite3');const d=new D(${JSON.stringify(dbPath)},{readonly:true});console.log(JSON.stringify(d.prepare(${JSON.stringify(sql)}).all()));d.close()`
    )
  )

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

const createStudent = async (page, student) => (await call(page, 'student.create', student)).id

const listStudents = async (page) => {
  const data = await call(page, 'student.list', {})
  return Array.isArray(data) ? data : Object.values(data).find(Array.isArray)
}

const todayStats = (page, day) =>
  call(page, 'statistics.getStats', { startDate: day, endDate: day })

const canonicalClassCounts = (stats) =>
  JSON.stringify([...stats.classCounts].sort((a, b) => a.classe.localeCompare(b.classe)))

const fileBytes = (path) => (existsSync(path) ? readFileSync(path) : Buffer.alloc(0))

const dbBytes = (dbPath) => Buffer.concat([fileBytes(dbPath), fileBytes(dbPath + '-wal')])

const leaksOf = (bytes, students) =>
  students.flatMap((s) => [s.nom, s.prenom, s.ine]).filter((needle) => bytes.includes(needle))

const dialogOf = (page) => page.getByRole('dialog')

const goStudents = async (page) => {
  await page.evaluate(() => {
    window.location.hash = '#/students'
  })
  await page.waitForSelector('main table tbody tr', { timeout: UI_TIMEOUT_MS })
}

const goJournal = async (page) => {
  await page.evaluate(() => {
    window.location.hash = '#/'
  })
  await page.waitForSelector('main form button[type="submit"]', { timeout: UI_TIMEOUT_MS })
}

const rowOf = (page, student) => page.locator('main table tbody tr', { hasText: student.nom })

const removeButtonOf = (page, student) =>
  rowOf(page, student).getByRole('button', {
    name: new RegExp(`^Retirer l'élève .*${student.nom}`)
  })

const waitText = async (page, text) => {
  try {
    await page.getByText(text).first().waitFor({ timeout: UI_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

const toastText = async (page) => {
  try {
    const alert = page.locator('[role="alert"]').first()
    await alert.waitFor({ timeout: UI_TIMEOUT_MS })
    return await alert.innerText()
  } catch {
    return ''
  }
}

const slowAnonymizeHandler = (app, delay) =>
  app.evaluate(
    ({ ipcMain }, cfg) => {
      const original = ipcMain._invokeHandlers.get(cfg.channel)
      globalThis.__originalAnonymize = original
      ipcMain.removeHandler(cfg.channel)
      ipcMain.handle(cfg.channel, async (event, ...args) => {
        await new Promise((resolve) => setTimeout(resolve, cfg.delay))
        return original(event, ...args)
      })
    },
    { channel: ANONYMIZE_CHANNEL, delay }
  )

const restoreAnonymizeHandler = (app) =>
  app.evaluate(({ ipcMain }, channel) => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, globalThis.__originalAnonymize)
  }, ANONYMIZE_CHANNEL)

const pickCsv = async (page, name, content) => {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8')
  })
}

const listDir = (dir) => (existsSync(dir) ? readdirSync(dir) : [])
const backupsOf = (dir, reason) =>
  listDir(dir).filter((f) => new RegExp(`^auto-.*-${reason}\\.db$`).test(f))

const seedTimes = buildSeedTimes(new Date(), MIN_SEED_TIMES)
if (seedTimes.length < MIN_SEED_TIMES) {
  console.error('Too early in the day to seed visits strictly in the past: retry in a few minutes')
  process.exit(EXIT_CANNOT_RUN)
}
const today = seedTimes[0].slice(0, 'YYYY-MM-DD'.length)

const tmp = mkdtempSync(join(tmpdir(), 'check-anonymize-'))
const userData = join(tmp, 'userData')
const backupsDir = join(userData, 'backups')
const livePath = join(userData, 'data', 'database.db')
mkdirSync(userData, { recursive: true })

let app
try {
  // 1. Seed
  let page
  ;({ app, page } = await launch(userData))
  const ids = {}
  for (const student of [ZORGLUB, NOVISIT, CONTROL, BATCH_ONE, BATCH_TWO, CSV_GONE]) {
    ids[student.nom] = await createStudent(page, student)
  }
  const visitOwners = [ZORGLUB, ZORGLUB, CONTROL, BATCH_ONE, CSV_GONE, CONTROL]
  await call(page, 'frequentation.createBatch', {
    frequentations: visitOwners.map((owner, i) => ({
      startsAt: seedTimes[i],
      activity: ACTIVITY,
      studentId: ids[owner.nom]
    }))
  })
  const visitTotal = visitOwners.length
  const statsBefore = await todayStats(page, today)
  expect(statsBefore.totalVisits === visitTotal, `1: seeded ${visitTotal} visits`)
  const countsBefore = canonicalClassCounts(statsBefore)
  const positive = dbBytes(livePath)
  expect(
    leaksOf(positive, [ZORGLUB]).length > 0,
    '1: positive control: the name/INE are visible in db+wal before anonymizing'
  )

  // 2. Anonymize one student with visits, through the UI
  await goStudents(page)
  await removeButtonOf(page, ZORGLUB).click()
  const dialog = dialogOf(page)
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  const dialogText = await dialog.innerText()
  expect(
    dialogText.includes('Cette action est irréversible.') &&
      dialogText.includes(
        "Le nom, le prénom et l'INE seront supprimés définitivement. Les visites et la classe sont conservées"
      ),
    `2: dialog states the irreversible message (got "${dialogText.slice(0, ERROR_EXCERPT)}")`
  )
  expect(
    dialogText.includes('contient encore les identités réelles') && dialogText.includes('30 jours'),
    '2: dialog states the backup note'
  )
  await dialog.getByRole('button', { name: 'Retirer', exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS })
  expect(
    (await toastText(page)).includes('1 anonymisé(s), 0 supprimé(s) sans visite'),
    '2: success toast counts 1 anonymized'
  )
  expect(
    backupsOf(backupsDir, 'anonymization').length === 1,
    `2: one auto-*-anonymization.db (got ${backupsOf(backupsDir, 'anonymization').join(',')})`
  )
  const remaining = await listStudents(page)
  expect(
    !remaining.some((s) => s.nom === ZORGLUB.nom || s.ine === ZORGLUB.ine),
    '2: Students list no longer has Zorglub'
  )
  expect(
    (await page.locator('main table tbody').innerText()).includes(ZORGLUB.nom) === false,
    '2: Students table does not show Zorglub'
  )
  const statsAfter = await todayStats(page, today)
  expect(statsAfter.totalVisits === visitTotal, '2: stats totalVisits unchanged')
  expect(canonicalClassCounts(statsAfter) === countsBefore, '2: stats classCounts unchanged')

  await goJournal(page)
  const journalReady = await waitText(page, ANONYMIZED_LABEL)
  const journalText = await page.locator('main').innerText()
  expect(journalReady, '2: Journal shows "Élève anonymisé"')
  expect(
    (journalText.match(new RegExp(ANONYMIZED_LABEL, 'g')) ?? []).length === 2,
    '2: Journal shows 2 anonymized rows (the 2 visits)'
  )
  expect(journalText.includes(ZORGLUB.classe), '2: Journal rows keep the class snapshot (3B)')
  expect(!journalText.includes(ZORGLUB.nom), '2: Journal does not show Zorglub')
  const journalEntries = await call(page, 'frequentation.getJournalEntries', {
    startDate: today,
    endDate: today
  })
  const anonymousEntries = journalEntries.filter((e) => e.student === null)
  expect(
    anonymousEntries.length === 2 &&
      anonymousEntries.every((e) => e.frequentation.studentClass === '3B'),
    '2: 2 journal entries have no student and keep class 3B'
  )
  const livePostAnonymize = dbBytes(livePath)
  expect(
    leaksOf(livePostAnonymize, [ZORGLUB]).length === 0,
    `2: db+wal bytes hold no Zorglub identity (found ${leaksOf(livePostAnonymize, [ZORGLUB]).join(',')})`
  )

  // 3. Delete-without-visits path (single student)
  await goStudents(page)
  await removeButtonOf(page, NOVISIT).click()
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  const noVisitText = await dialog.innerText()
  expect(
    noVisitText.includes('sera simplement supprimé') &&
      !noVisitText.includes('Les visites et la classe sont conservées'),
    `3: dialog says the student without visit is simply deleted (got "${noVisitText.slice(0, ERROR_EXCERPT)}")`
  )
  await dialog.getByRole('button', { name: 'Retirer', exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS })
  expect(
    (await toastText(page)).includes('0 anonymisé(s), 1 supprimé(s) sans visite'),
    '3: success toast counts 1 deleted without visit'
  )
  expect(
    !(await listStudents(page)).some((s) => s.nom === NOVISIT.nom),
    '3: Sansvisite is gone from the Students list'
  )

  // 4. Batch retrait (1 with visit + 1 without) and the dialog cannot be closed while pending
  await goStudents(page)
  await slowAnonymizeHandler(app, PENDING_DELAY_MS)
  for (const student of [BATCH_ONE, BATCH_TWO]) {
    await page
      .getByRole('checkbox', {
        name: `Sélectionner ${student.prenom} ${student.nom}`,
        exact: false
      })
      .check()
  }
  await page.getByRole('button', { name: 'Retirer la sélection' }).click()
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  const batchText = await dialog.innerText()
  expect(
    batchText.includes('Retirer 2 élèves ?'),
    `4: batch dialog title (got "${batchText.slice(0, 80)}")`
  )
  expect(
    batchText.includes('1 élève sans visite sera simplement supprimé'),
    '4: batch dialog notes 1 student without visit'
  )
  await dialog.getByRole('button', { name: 'Retirer', exact: true }).click()
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await page.mouse.click(2, 2)
  await page.waitForTimeout(250)
  expect(
    (await dialog.count()) === 1 && (await dialog.isVisible()),
    '4: dialog stays open on Escape and backdrop click while the removal is pending'
  )
  expect(
    await dialog.getByRole('button', { name: 'Retirer', exact: true }).isDisabled(),
    '4: confirm button disabled while pending'
  )
  await dialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS + PENDING_DELAY_MS })
  await restoreAnonymizeHandler(app)
  expect(
    (await toastText(page)).includes('1 anonymisé(s), 1 supprimé(s) sans visite'),
    '4: batch success toast counts 1 anonymized + 1 deleted'
  )
  const afterBatch = await listStudents(page)
  expect(
    !afterBatch.some((s) => s.nom === BATCH_ONE.nom || s.nom === BATCH_TWO.nom),
    '4: batch students are gone from the list'
  )
  expect(
    (await todayStats(page, today)).totalVisits === visitTotal,
    '4: stats totalVisits unchanged'
  )
  expect(
    canonicalClassCounts(await todayStats(page, today)) === countsBefore,
    '4: stats classCounts unchanged'
  )

  // 5. CSV import with removal. Left: Controle, Csvabsent (1 visit), Csvvide (none); the file only
  // lists Controle, so 2 of 3 go: more than half, hence the typed confirmation.
  await createStudent(page, CSV_GONE_EMPTY)
  await goStudents(page)
  await page.getByRole('button', { name: 'Importer CSV' }).click()
  const modal = dialogOf(page)
  await modal.waitFor({ timeout: UI_TIMEOUT_MS })
  await modal.getByLabel('Retirer les élèves absents du fichier').check()
  // 5a. column-shifted row blocks the removal
  const shifted = [
    CSV_HEADER,
    csvLine(CONTROL),
    `${CSV_GONE.nom};${CSV_GONE.prenom};${CSV_GONE.classe};${CSV_GONE.ine};extra`
  ].join('\n')
  await pickCsv(page, 'shifted.csv', shifted)
  const blocked = await waitText(
    page,
    "le retrait est impossible tant qu'elles ne sont pas corrigées"
  )
  expect(blocked, '5a: column-shifted row blocks the removal with the rowErrors message')
  expect(
    await modal.getByRole('button', { name: 'Importer et retirer' }).isDisabled(),
    '5a: submit disabled while blocked'
  )
  // 5b. clean file: preview + typed confirmation (1 of 2 is more than half)
  await pickCsv(page, 'clean.csv', [CSV_HEADER, csvLine(CONTROL)].join('\n'))
  const preview = await waitText(page, '2 élèves sur 3 seront retirés')
  expect(preview, '5b: preview says 2 élèves sur 3 seront retirés')
  expect(
    (await modal.innerText()).includes(CSV_GONE.nom.toUpperCase()) ||
      (await modal.innerText()).includes(CSV_GONE.nom),
    '5b: preview lists the student to remove'
  )
  const submit = modal.getByRole('button', { name: 'Importer et retirer' })
  expect(await submit.isDisabled(), '5b: submit disabled until the phrase is typed')
  const confirmField = modal.getByLabel(`Pour confirmer, tapez ${CONFIRM_KEYWORD} 2`)
  await confirmField.fill(`${CONFIRM_KEYWORD} 1`)
  expect(await submit.isDisabled(), '5b: wrong phrase keeps submit disabled')
  await confirmField.fill(`${CONFIRM_KEYWORD} 2`)
  expect(await submit.isEnabled(), '5b: right phrase enables submit')
  await submit.click()
  const toast = await toastText(page)
  expect(
    toast.includes('1 anonymisé(s), 1 supprimé(s) sans visite'),
    `5b: import success mentions the removal (got "${toast}")`
  )
  expect(
    backupsOf(backupsDir, 'anonymization').length >= 2,
    '5b: another anonymization backup exists'
  )
  const afterCsv = await listStudents(page)
  expect(
    afterCsv.length === 1 && afterCsv[0].nom === CONTROL.nom,
    `5b: only Controle remains (got ${afterCsv.map((s) => s.nom).join(',')})`
  )
  expect(
    (await todayStats(page, today)).totalVisits === visitTotal,
    '5b: stats totalVisits unchanged'
  )
  expect(
    canonicalClassCounts(await todayStats(page, today)) === countsBefore,
    '5b: stats classCounts unchanged'
  )
  const anonymousNow = (
    await call(page, 'frequentation.getJournalEntries', { startDate: today, endDate: today })
  ).filter((e) => e.student === null)
  expect(anonymousNow.length === 4, `5b: 4 anonymous journal entries (got ${anonymousNow.length})`)

  // 6. No byte of any removed identity in the live db or its WAL, then after a clean close
  expect(
    leaksOf(dbBytes(livePath), LEAVERS).length === 0,
    `6: running app: db+wal hold no removed identity (found ${leaksOf(dbBytes(livePath), LEAVERS).join(',')})`
  )
  await closeQuietly(app)
  app = undefined
  const closedLeaks = leaksOf(dbBytes(livePath), LEAVERS)
  expect(
    closedLeaks.length === 0,
    `6: closed app: db+wal hold no removed identity (found ${closedLeaks.join(',')})`
  )
  const nullVisits = sqliteJson(
    livePath,
    'SELECT COUNT(*) AS c FROM frequentation WHERE student_id IS NULL'
  )
  expect(
    nullVisits[0].c === 4,
    `6: 4 frequentation rows have student_id NULL (got ${nullVisits[0].c})`
  )
  const leftover = sqliteJson(
    livePath,
    "SELECT COUNT(*) AS c FROM students WHERE nom IN ('Zorglub','Sansvisite','Batchun','Batchdeux','Csvabsent','Csvvide') OR ine='ZZ99999999Z'"
  )
  expect(leftover[0].c === 0, '6: no removed student left in the students table')

  // 7. Legacy UTC rows are normalised at startup (with a backup) and old visits are never purged
  const controlId = ids[CONTROL.nom]
  const OLD_VISIT = '2023-05-04T10:00:00'
  const legacySql =
    "const now=new Date().toISOString();const ins=d.prepare('INSERT INTO frequentation (starts_at,activity,student_id,created_at,updated_at,student_classe) VALUES (?,?,?,?,?,?)');" +
    `ins.run('2026-03-10T09:30:00Z','${ACTIVITY}',${controlId},now,now,'4A');` +
    `ins.run('2026-03-10T09:30:00+02:00','${ACTIVITY}',${controlId},now,now,'4A');` +
    `ins.run('${OLD_VISIT}','${ACTIVITY}',${controlId},now,now,'4A');` +
    "d.prepare(\"DELETE FROM settings WHERE key='migrations.startsAtLocal.done'\").run();d.pragma('wal_checkpoint(TRUNCATE)');"
  runInElectronNode(
    `const D=require('better-sqlite3');const d=new D(${JSON.stringify(livePath)});d.pragma('journal_mode = WAL');${legacySql}d.close()`
  )
  expect(backupsOf(backupsDir, 'normalization').length === 0, '7: no normalization backup yet')
  ;({ app, page } = await launch(userData, { TZ: PARIS_TZ }))
  const visits = await call(page, 'frequentation.list', {})
  const startsAts = visits.map((v) => v.startsAt).sort()
  expect(
    startsAts.includes('2026-03-10T10:30:00') &&
      startsAts.filter((v) => v === '2026-03-10T10:30:00').length === 1 &&
      startsAts.includes('2026-03-10T08:30:00'),
    `7: Z and +02:00 rows converted to Paris wall-clock (got ${startsAts.join(', ')})`
  )
  expect(
    startsAts.every((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)),
    '7: every starts_at is a local wall-clock string'
  )
  expect(
    backupsOf(backupsDir, 'normalization').length === 1,
    `7: one auto-*-normalization.db (got ${backupsOf(backupsDir, 'normalization').join(',')})`
  )
  expect(startsAts.includes(OLD_VISIT), '7: the 3-year-old visit is kept (no 2-year purge)')
  expect(visits.length === visitTotal + 3, `7: no visit was purged (got ${visits.length})`)
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
  console.error(`Anonymize check FAILED (${offenders.length}):`)
  for (const o of offenders) {
    console.error(' - ' + o)
  }
  process.exit(EXIT_FAIL)
}
console.log('Anonymize check passed')
