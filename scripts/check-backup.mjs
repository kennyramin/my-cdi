#!/usr/bin/env node
// Electron end-to-end check of backup / restore (not part of vitest). Launches the built app on a
// throwaway --user-data-dir, drives the Settings "Données" card and inspects files on disk.
// Dialogs and relaunch are stubbed from the main process (no production hook): the second Electron
// instance started on the same user-data-dir proves that the restored data is what boots.
// Exit code 0 = pass, 1 = failures printed.
//
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright xvfb-run -a npm run check:backup
//   - PLAYWRIGHT_MODULE is required: playwright is not a project dependency, point it at an install.
//   - check:backup aligns better-sqlite3 to the ELECTRON ABI and leaves it there: run `npm test`
//     (which realigns) or `npm run rebuild:tests` afterwards before running vitest.
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  closeSync,
  rmSync,
  writeFileSync
} from 'node:fs'
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
const LOADING_DELAY_MS = 2500
const STUDENT_COUNT = 3
const DELETED_COUNT = 2
const OLD_BACKUP_DAYS = 3
const MS_PER_DAY = 86400000
const SQLITE_MAGIC = 'SQLite format 3\0'
const JOURNAL_VERSION_OFFSET = 18
const HEADER_LENGTH = 20
const LEGACY_JOURNAL_BYTE = 1
const GET_STATUS_CHANNEL = 'backup.getStatus'
const ERROR_EXCERPT = 300
const EXIT_FAIL = 1

const FILE_NAME = "sauvegarde élève d'été.db"
const LABELS = {
  backup: 'Sauvegarder maintenant',
  restore: 'Restaurer une sauvegarde…',
  retry: 'Réessayer',
  cancel: 'Annuler',
  confirmRestore: 'Restaurer',
  confirmDelete: 'Supprimer'
}
const TEXT = {
  loading: 'Dernière sauvegarde : chargement…',
  never: 'Dernière sauvegarde : jamais',
  today: "Dernière sauvegarde : aujourd'hui",
  days: `Dernière sauvegarde : il y a ${OLD_BACKUP_DAYS} jours`
}

const offenders = []
const expect = (ok, what) => {
  if (!ok) {
    offenders.push(what)
  }
}

const launch = async (userDataDir) => {
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`, root]
  })
  const page = await app.firstWindow()
  await page.waitForSelector('main', { timeout: READY_TIMEOUT_MS })
  return { app, page }
}

const stubDialogs = (app, kind, filePath) =>
  app.evaluate(
    ({ dialog }, { kind: k, filePath: p }) => {
      if (k === 'save') {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: p })
      } else {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
      }
    },
    { kind, filePath }
  )

const stubRelaunch = (app) =>
  app.evaluate(({ app: electronApp }) => {
    globalThis.__relaunches = 0
    electronApp.relaunch = () => {
      globalThis.__relaunches += 1
    }
    electronApp.exit = () => {}
  })

const relaunchCount = (app) => app.evaluate(() => globalThis.__relaunches ?? 0)

const studentCount = (page) =>
  page.evaluate(async () => {
    const res = await window.electronAPI.student.list({})
    if (!res.success) {
      return -1
    }
    const rows = Array.isArray(res.data) ? res.data : Object.values(res.data).find(Array.isArray)
    return rows ? rows.length : -1
  })

const seedStudents = (page, count) =>
  page.evaluate(
    async (cfg) => {
      const ids = []
      for (let i = 0; i < cfg.count; i++) {
        const res = await window.electronAPI.student.create({
          nom: 'Nom' + i,
          prenom: 'Prenom' + i,
          classe: '4e B',
          ine: String(i).padStart(cfg.ineLength, 'X')
        })
        if (!res.success) {
          throw new Error('seed failed: ' + JSON.stringify(res).slice(0, cfg.excerpt))
        }
        ids.push(res.data.id)
      }
      return ids
    },
    { count, ineLength: 11, excerpt: ERROR_EXCERPT }
  )

const deleteStudents = (page, ids) =>
  page.evaluate(async (list) => {
    for (const id of list) {
      const res = await window.electronAPI.student.delete({ id })
      if (!res.success) {
        throw new Error('delete failed: ' + JSON.stringify(res))
      }
    }
  }, ids)

const goSettings = async (page) => {
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.getByRole('button', { name: LABELS.backup }).waitFor({ timeout: UI_TIMEOUT_MS })
}

const statusText = (page) => page.locator('[role="status"]').first().innerText()

const waitStatus = async (page, text) => {
  try {
    await page
      .locator('[role="status"]', { hasText: text })
      .first()
      .waitFor({ timeout: UI_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

const alertText = async (page) => {
  try {
    const alert = page.locator('[role="alert"]').first()
    await alert.waitFor({ timeout: UI_TIMEOUT_MS })
    return await alert.innerText()
  } catch {
    return null
  }
}

const header = (path) => {
  const fd = openSync(path, 'r')
  const buf = Buffer.alloc(HEADER_LENGTH)
  readSync(fd, buf, 0, HEADER_LENGTH, 0)
  closeSync(fd)
  return buf
}

const listDir = (dir) => (existsSync(dir) ? readdirSync(dir) : [])
const autoFiles = (dir) => listDir(dir).filter((f) => /^auto-.*\.db$/.test(f))

const backupStatus = (page) =>
  page.evaluate(async () => (await window.electronAPI.backup.getStatus()).data)

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

const closeQuietly = async (app) => {
  try {
    await app.close()
  } catch {
    // already gone
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'check-backup-'))
const userData = join(tmp, 'userData')
const exportsDir = join(tmp, 'exports')
const backupsDir = join(userData, 'backups')
const livePath = join(userData, 'data', 'database.db')
const goodBackup = join(exportsDir, FILE_NAME)
mkdirSync(exportsDir, { recursive: true })

let app
try {
  // 1. Fresh start: no migration backup, seed 3 students
  let page
  ;({ app, page } = await launch(userData))
  expect(autoFiles(backupsDir).length === 0, '1: fresh DB must not produce an auto-*-migration.db')
  const ids = await seedStudents(page, STUDENT_COUNT)
  expect((await studentCount(page)) === STUDENT_COUNT, '1: seeded student count is 3')

  // 2. Manual backup
  await goSettings(page)
  expect(await waitStatus(page, TEXT.never), `2: status "never" (got "${await statusText(page)}")`)
  await stubDialogs(app, 'save', goodBackup)
  await page.getByRole('button', { name: LABELS.backup }).click()
  const okToast = await alertText(page)
  expect(
    okToast !== null && okToast.includes('Sauvegarde enregistrée'),
    `2: success toast (got ${okToast})`
  )
  expect(existsSync(goodBackup), '2: backup file exists')
  if (existsSync(goodBackup)) {
    const head = header(goodBackup)
    expect(
      head.subarray(0, SQLITE_MAGIC.length).toString('latin1') === SQLITE_MAGIC,
      '2: SQLite magic header'
    )
    expect(
      head[JOURNAL_VERSION_OFFSET] === LEGACY_JOURNAL_BYTE &&
        head[JOURNAL_VERSION_OFFSET + 1] === LEGACY_JOURNAL_BYTE,
      `2: journal header bytes 18/19 are 01 01 (got ${head[18]} ${head[19]})`
    )
  }
  expect(
    !existsSync(goodBackup + '-wal') && !existsSync(goodBackup + '-shm'),
    '2: no -wal/-shm sidecar next to the backup'
  )
  expect(
    await waitStatus(page, TEXT.today),
    `2: status "aujourd'hui" (got "${await statusText(page)}")`
  )
  expect((await backupStatus(page)).lastBackupAt !== null, '2: getStatus().lastBackupAt non-null')

  // 3. Backup onto the live DB path must be refused
  await page.evaluate(() => document.querySelector('[role="alert"] button')?.click())
  await stubDialogs(app, 'save', livePath)
  await page.getByRole('button', { name: LABELS.backup }).click()
  await page
    .waitForFunction(
      (s) =>
        [...document.querySelectorAll('[role="alert"]')].some((e) => e.textContent.includes(s)),
      'base de données active',
      { timeout: UI_TIMEOUT_MS }
    )
    .catch(() => {})
  const liveToast = await alertText(page)
  expect(
    liveToast !== null && liveToast.includes('base de données active'),
    `3: error toast for live DB path (got ${liveToast})`
  )
  expect((await studentCount(page)) === STUDENT_COUNT, '3: live DB keeps its 3 students')

  // 4. Diverge, then bad file, then cancel
  await deleteStudents(page, ids.slice(0, DELETED_COUNT))
  expect((await studentCount(page)) === 1, '4: 1 student left after deletes')
  const fake = join(exportsDir, 'not-a-db.db')
  writeFileSync(fake, 'this is just text, not a database')
  await stubRelaunch(app)
  await stubDialogs(app, 'open', fake)
  await page.getByRole('button', { name: LABELS.restore }).click()
  await page
    .waitForFunction(
      (s) =>
        [...document.querySelectorAll('[role="alert"]')].some((e) => e.textContent.includes(s)),
      "n'est pas une base de données valide",
      { timeout: UI_TIMEOUT_MS }
    )
    .catch(() => {})
  const badToast = await alertText(page)
  expect(
    badToast !== null && badToast.includes("n'est pas une base de données valide"),
    `4: error toast for text file (got ${badToast})`
  )
  expect((await studentCount(page)) === 1, '4: count still 1 after rejected file')

  // 4b. A valid-looking copy stripped of __drizzle_migrations would not boot: it must be refused
  const noMigrations = join(exportsDir, 'no-migrations.db')
  copyFileSync(goodBackup, noMigrations)
  runInElectronNode(
    `const D=require('better-sqlite3');const d=new D(${JSON.stringify(noMigrations)});d.exec('DROP TABLE __drizzle_migrations');d.close()`
  )
  await page.evaluate(() => document.querySelector('[role="alert"] button')?.click())
  await stubDialogs(app, 'open', noMigrations)
  await page.getByRole('button', { name: LABELS.restore }).click()
  await page
    .waitForFunction(
      (s) =>
        [...document.querySelectorAll('[role="alert"]')].some((e) => e.textContent.includes(s)),
      "pas d'information de version",
      { timeout: UI_TIMEOUT_MS }
    )
    .catch(() => {})
  const noMigrationsToast = await alertText(page)
  expect(
    noMigrationsToast !== null && noMigrationsToast.includes("pas d'information de version"),
    `4b: error toast for backup without migrations (got ${noMigrationsToast})`
  )
  expect((await page.getByRole('dialog').count()) === 0, '4b: no confirmation dialog opened')
  expect((await studentCount(page)) === 1, '4b: live data unchanged after rejected backup')
  expect((await relaunchCount(app)) === 0, '4b: no relaunch after rejected backup')
  await page.evaluate(() => document.querySelector('[role="alert"] button')?.click())

  await stubDialogs(app, 'open', goodBackup)
  await page.getByRole('button', { name: LABELS.restore }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  expect((await dialog.innerText()).includes(FILE_NAME), '4: confirmation names the file')
  await dialog.getByRole('button', { name: LABELS.cancel }).click()
  await dialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS })
  expect((await studentCount(page)) === 1, '4: count still 1 after cancel')
  expect((await relaunchCount(app)) === 0, '4: no relaunch after cancel')

  // 5. Restore + confirm
  await page.getByRole('button', { name: LABELS.restore }).click()
  await dialog.waitFor({ timeout: UI_TIMEOUT_MS })
  await dialog.getByRole('button', { name: LABELS.confirmRestore }).click()
  const deadline = Date.now() + UI_TIMEOUT_MS
  while ((await relaunchCount(app)) === 0 && Date.now() < deadline) {
    await page.waitForTimeout(100)
  }
  expect(
    (await relaunchCount(app)) === 1,
    `5: relaunch called once (got ${await relaunchCount(app)})`
  )
  const restoreSafety = autoFiles(backupsDir).filter((f) => f.endsWith('-restore.db'))
  expect(restoreSafety.length === 1, `5: one auto-*-restore.db (got ${restoreSafety.join(',')})`)
  if (restoreSafety.length === 1) {
    const out = runInElectronNode(
      `const D=require('better-sqlite3');const d=new D(${JSON.stringify(join(backupsDir, restoreSafety[0]))},{readonly:true});console.log(d.prepare('select count(*) c from students').get().c)`
    )
    expect(out === '1', `5: safety copy holds 1 student (got ${out})`)
  }
  await closeQuietly(app)

  // 6. Second instance on the same dir
  writeFileSync(join(backupsDir, 'notes.txt'), 'keep me')
  writeFileSync(join(backupsDir, 'auto-20200101-000000-migration.db'), 'ordinary automatic copy')
  ;({ app, page } = await launch(userData))
  expect(
    (await studentCount(page)) === STUDENT_COUNT,
    `6: restored data boots with 3 students (got ${await studentCount(page)})`
  )
  await goSettings(page)
  const deleteButton = page.getByRole('button', { name: /Supprimer les sauvegardes automatiques/ })
  const deleteLabel = await deleteButton.innerText()
  expect(deleteLabel.includes('(1)'), `6: card shows automatic count 1 (got "${deleteLabel}")`)
  await deleteButton.click()
  const confirm = page.getByRole('dialog')
  await confirm.waitFor({ timeout: UI_TIMEOUT_MS })
  await confirm.getByRole('button', { name: LABELS.confirmDelete }).click()
  await confirm.waitFor({ state: 'hidden', timeout: UI_TIMEOUT_MS })
  await page.waitForTimeout(500)
  expect(
    autoFiles(backupsDir).length === 1 && autoFiles(backupsDir)[0].endsWith('-restore.db'),
    `6: only the restore safety copy is left (got ${autoFiles(backupsDir).join(',')})`
  )
  expect(existsSync(join(backupsDir, 'notes.txt')), '6: unrelated notes.txt survives')
  await closeQuietly(app)

  // 7. Older schema: the last two migrations (settings table, then the nullable student_id rebuild)
  // forgotten + settings table dropped
  runInElectronNode(
    `const D=require('better-sqlite3');const d=new D(${JSON.stringify(livePath)});d.pragma('journal_mode = WAL');` +
      `d.exec('DROP TABLE settings');d.exec('DELETE FROM __drizzle_migrations WHERE created_at IN (SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 2)');d.pragma('wal_checkpoint(TRUNCATE)');d.close()`
  )
  ;({ app, page } = await launch(userData))
  const migrationBackups = autoFiles(backupsDir).filter((f) => f.endsWith('-migration.db'))
  expect(
    migrationBackups.length === 1,
    `7: one auto-*-migration.db (got ${migrationBackups.join(',')})`
  )
  const themeRead = await page.evaluate(
    async () => (await window.electronAPI.settings.getTheme()).success
  )
  expect(themeRead === true, '7: settings table recreated, theme read works')
  expect((await studentCount(page)) === STUDENT_COUNT, '7: students intact after migration')
  await closeQuietly(app)

  // 8. Status card states: loading, error + retry, recent (stubbed handler in the main process)
  ;({ app, page } = await launch(userData))
  await app.evaluate(
    ({ ipcMain }, cfg) => {
      ipcMain.removeHandler(cfg.channel)
      ipcMain.handle(cfg.channel, async () => {
        await new Promise((r) => setTimeout(r, cfg.delay))
        return { success: true, data: { lastBackupAt: null, automaticCount: 0 } }
      })
    },
    { channel: GET_STATUS_CHANNEL, delay: LOADING_DELAY_MS }
  )
  await page.reload()
  await goSettings(page).catch(() => {})
  expect(await waitStatus(page, TEXT.loading), '8: loading state shown while status pending')
  expect(await waitStatus(page, TEXT.never), '8: loading resolves to "jamais"')
  await app.evaluate(({ ipcMain }, channel) => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, async () => ({ success: false, error: 'boom', code: 'UNKNOWN_ERROR' }))
  }, GET_STATUS_CHANNEL)
  await page.reload()
  await page.getByRole('button', { name: LABELS.retry }).waitFor({ timeout: UI_TIMEOUT_MS })
  expect(
    await page.getByRole('button', { name: LABELS.backup }).isDisabled(),
    '8: backup disabled in error state'
  )
  await app.evaluate(
    ({ ipcMain }, cfg) => {
      ipcMain.removeHandler(cfg.channel)
      ipcMain.handle(cfg.channel, async () => ({
        success: true,
        data: {
          lastBackupAt: new Date(Date.now() - cfg.days * cfg.msPerDay).toISOString(),
          automaticCount: 0
        }
      }))
    },
    { channel: GET_STATUS_CHANNEL, days: OLD_BACKUP_DAYS, msPerDay: MS_PER_DAY }
  )
  await page.getByRole('button', { name: LABELS.retry }).click()
  expect(
    await waitStatus(page, TEXT.days),
    `8: retry recovers to "${TEXT.days}" (got "${await statusText(page)}")`
  )
} catch (error) {
  offenders.push(`script error: ${error instanceof Error ? error.stack : String(error)}`)
} finally {
  if (app) {
    await closeQuietly(app)
  }
  rmSync(tmp, { recursive: true, force: true })
}

if (offenders.length > 0) {
  console.error(`Backup check FAILED (${offenders.length}):`)
  for (const o of offenders) {
    console.error(' - ' + o)
  }
  process.exit(EXIT_FAIL)
}
console.log('Backup check passed')
