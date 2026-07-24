import GameCanvas from './core/GameCanvas'
import Hud from './ui/Hud'

// App = l'écran de jeu complet : la scène 3D + l'interface 2D par-dessus.
// On garde ce fichier tout petit : il ne fait qu'assembler les gros blocs.
export default function App() {
  return (
    <>
      <GameCanvas />
      <Hud />
    </>
  )
}
