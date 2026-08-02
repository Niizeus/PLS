export type RunEventTriggerKind = 'realElapsedSeconds' | 'realElapsedMinutes' | 'gameElapsedMinutes' | 'gameTime'

export interface RunEventTrigger {
  kind: RunEventTriggerKind
  value?: number
  day?: number
  hour?: number
  minute?: number
}

export interface RunEventCondition {
  type: string
  negate?: boolean
  params?: Record<string, unknown>
}

export interface RunEventEffect {
  type: string
  params?: Record<string, unknown>
}

export interface RunTimelineEvent {
  id: string
  enabled?: boolean
  once?: boolean
  trigger: RunEventTrigger
  conditions?: RunEventCondition[]
  effects?: RunEventEffect[]
}

export interface RunTimelineFile {
  version: number
  events: RunTimelineEvent[]
}
