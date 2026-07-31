import { useEffect, useState } from 'react'
import GameCanvas from './core/GameCanvas'
import RadioAudioSystem from './audio/RadioAudioSystem'
import RadioControls from './audio/RadioControls'
import GameTimeTicker from './gameplay/time/GameTimeTicker'
import TimeDevControls from './gameplay/time/TimeDevControls'
import NeedsTicker from './gameplay/stats/NeedsTicker'
import ApplyDisplaySettings from './gameplay/settings/ApplyDisplaySettings'
import Hud from './ui/Hud'
import DevToolsControls from './devtools/DevToolsControls'
import DevToolsPanel from './devtools/DevToolsPanel'
import PerfProfilerControls from './devtools/PerfProfilerControls'
import CollisionDebugControls from './devtools/CollisionDebugControls'
import LoadingScreen from './ui/LoadingScreen'
import { runWorldStartupWarmup, type WarmupProgress } from './world/startupWarmup'

// App = l'écran de jeu complet : la scène 3D + l'interface 2D par-dessus.
// On garde ce fichier tout petit : il ne fait qu'assembler les gros blocs.
export default function App() {
  const [warmup, setWarmup] = useState<WarmupProgress>({ label: 'Initialisation', done: 0, total: 1 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    runWorldStartupWarmup((progress) => {
      if (alive) setWarmup(progress)
    })
      .catch((error) => {
        console.warn('[warmup] impossible, demarrage degrade', error)
      })
      .finally(() => {
        if (alive) setReady(true)
      })

    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <GameTimeTicker />
      <DevToolsControls />
      <TimeDevControls />
      <NeedsTicker />
      <RadioAudioSystem />
      <RadioControls />
      {ready ? (
        <>
          <GameCanvas />
          {/* Applique les réglages d'image du joueur au canvas qui vient d'être monté. */}
          <ApplyDisplaySettings />
          <Hud />
        </>
      ) : (
        <LoadingScreen progress={warmup} />
      )}
      <DevToolsPanel />
      <PerfProfilerControls />
      <CollisionDebugControls />
    </>
  )
}
