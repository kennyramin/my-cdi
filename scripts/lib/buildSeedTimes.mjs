// Local wall-clock seed times for today, all strictly before `now` truncated to the minute.
// One per minute from 00:00 (index i -> minute i of the day), at most `wanted`. The minute right
// before now is also skipped as a safety margin (clock skew between the script and the app).
const MINUTES_PER_HOUR = 60
const SAFETY_MINUTES = 1
const pad = (n) => String(n).padStart(2, '0')

export const buildSeedTimes = (now, wanted) => {
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const available = now.getHours() * MINUTES_PER_HOUR + now.getMinutes() - SAFETY_MINUTES
  const count = Math.max(0, Math.min(wanted, available))
  return Array.from({ length: count }, (_, i) => {
    const hour = Math.floor(i / MINUTES_PER_HOUR)
    return `${day}T${pad(hour)}:${pad(i % MINUTES_PER_HOUR)}:00`
  })
}
