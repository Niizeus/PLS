import timelineFile from '../../data/runTimeline.json'
import { useRunStore } from './runStore'
import type { RunEventCondition, RunEventEffect, RunTimelineEvent, RunTimelineFile } from './runEventTypes'

const timeline = normalizeTimeline(timelineFile as RunTimelineFile)

export function processRunTimelineEvents() {
  const store = useRunStore.getState()
  if (store.status !== 'active') return

  for (const event of timeline.events) {
    if (event.enabled === false) continue
    if ((event.once ?? true) && store.hasEventFired(event.id)) continue
    if (!isTriggerDue(event, store)) continue
    if (!areConditionsMet(event.conditions ?? [])) continue

    store.markEventFired(event.id)
    applyEffects(event.effects ?? [])
  }
}

function isTriggerDue(event: RunTimelineEvent, clock: ReturnType<typeof useRunStore.getState>): boolean {
  const trigger = event.trigger
  switch (trigger.kind) {
    case 'realElapsedSeconds':
      return clock.realElapsedSeconds >= safeNumber(trigger.value)
    case 'realElapsedMinutes':
      return clock.realElapsedSeconds >= safeNumber(trigger.value) * 60
    case 'gameElapsedMinutes':
      return clock.gameElapsedMinutes >= safeNumber(trigger.value)
    case 'gameTime':
      return getRunClockOrdinalMinute(clock) >= getTriggerOrdinalMinute(trigger.day, trigger.hour, trigger.minute)
  }
}

function areConditionsMet(conditions: RunEventCondition[]): boolean {
  return conditions.every((condition) => {
    const result = evaluateCondition(condition)
    return condition.negate ? !result : result
  })
}

function evaluateCondition(condition: RunEventCondition): boolean {
  switch (condition.type) {
    case 'always':
      return true
    default:
      return false
  }
}

function applyEffects(effects: RunEventEffect[]) {
  for (const effect of effects) {
    if (effect.type === 'noop') continue
  }
}

function getRunClockOrdinalMinute(clock: { runDay: number; gameHour: number; gameMinute: number }): number {
  return (clock.runDay - 1) * 24 * 60 + clock.gameHour * 60 + clock.gameMinute
}

function getTriggerOrdinalMinute(day: number | undefined, hour: number | undefined, minute: number | undefined): number {
  const safeDay = Math.max(1, Math.floor(safeNumber(day, 1)))
  const safeHour = Math.min(23, Math.max(0, Math.floor(safeNumber(hour))))
  const safeMinute = Math.min(59, Math.max(0, Math.floor(safeNumber(minute))))
  return (safeDay - 1) * 24 * 60 + safeHour * 60 + safeMinute
}

function normalizeTimeline(input: RunTimelineFile): RunTimelineFile {
  return {
    version: Number.isFinite(input.version) ? input.version : 1,
    events: Array.isArray(input.events)
      ? input.events.filter((event) => event && typeof event.id === 'string' && event.trigger)
      : [],
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
