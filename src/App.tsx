import GameCanvas from './core/GameCanvas'
import RadioAudioSystem from './audio/RadioAudioSystem'
import RadioControls from './audio/RadioControls'
import GameTimeTicker from './gameplay/time/GameTimeTicker'
import TimeDevControls from './gameplay/time/TimeDevControls'
import NeedsTicker from './gameplay/stats/NeedsTicker'
import Hud from './ui/Hud'
import DevToolsControls from './devtools/DevToolsControls'
import DevToolsPanel from './devtools/DevToolsPanel'

// App = l'écran de jeu complet : la scène 3D + l'interface 2D par-dessus.
// On garde ce fichier tout petit : il ne fait qu'assembler les gros blocs.
export default function App() {
  return (
    <>
      <GameTimeTicker />
      <DevToolsControls />
      <TimeDevControls />
      <NeedsTicker />
      <RadioAudioSystem />
      <RadioControls />
      <GameCanvas />
      <Hud />
      <DevToolsPanel />
    </>
  )
}
