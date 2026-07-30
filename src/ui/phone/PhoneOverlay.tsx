import { useEffect, useState } from 'react'
import { useVehicleTelemetryStore } from '../../entities/vehicles/vehicleTelemetryStore'
import { KEY } from '../../gameplay/input/keyMap'
import { setCursorUiOpen } from '../../gameplay/input/pointerLock'
import { usePhoneStore } from '../../gameplay/phone/phoneStore'
import {
  formatGameTime,
  getDayPhase,
  getDayPhaseLabel,
  getSkyColors,
  useGameTimeStore,
} from '../../gameplay/time/gameTimeStore'
import PhoneHome from './PhoneHome'
import ComingSoonApp from './apps/ComingSoonApp'
import { PHONE_APPS, findPhoneApp } from './apps'
import { PHONE, screen, shell } from './phoneStyle'

/**
 * 📱 Le téléphone à l'écran : la coque, l'écran, et la navigation.
 *
 * ── Choix de conception ─────────────────────────────────────────────────────
 * • Touche **P** pour le sortir / le ranger, **Échap** pour revenir en arrière.
 * • **Le jeu ne se met PAS en pause.** C'est un objet du monde, pas un menu :
 *   Chibrux sort son tel, la ville continue de tourner (et ça marche aussi en
 *   voiture). Conséquence assumée : on peut encore marcher avec le tel ouvert.
 * • Il s'affiche **en bas à droite** et ne masque donc ni les stats (à gauche)
 *   ni la minimap (en haut à droite) — contrairement à l'inventaire et à la
 *   carte qui, eux, sont plein écran.
 * • Le fond d'écran suit l'**heure du jeu** (`getSkyColors`) : à minuit le tel
 *   est bleu nuit, au couchant il est orange. Rien à maintenir, ça réutilise le
 *   cycle jour/nuit existant.
 */

/** Nombre d'icônes par ligne sur l'accueil — sert aussi aux flèches haut/bas. */
const COLUMNS = 3

/** Marge par rapport au coin bas droit de l'écran. */
const EDGE = 18
/**
 * Au volant, le tableau de bord occupe déjà le coin bas droit (`VehicleDashboard`,
 * 238 px de large). Le téléphone se décale alors à sa gauche au lieu de lui passer
 * dessus. Si le tableau de bord change de largeur, c'est ici qu'on ajuste.
 */
const EDGE_DRIVING = EDGE + 238 + 12

export default function PhoneOverlay() {
  const isOpen = usePhoneStore((s) => s.isOpen)
  const appId = usePhoneStore((s) => s.appId)
  const riding = useVehicleTelemetryStore((s) => s.riding)
  const scale = usePhoneScale()
  const [selected, setSelected] = useState(0)

  // Le tel reste MONTÉ le temps de l'animation de sortie, sinon il disparaîtrait
  // d'un coup au lieu de redescendre dans la poche.
  const [mounted, setMounted] = useState(isOpen)
  const [shown, setShown] = useState(false)

  // Téléphone sorti = curseur rendu au joueur (et pas repris au premier clic).
  useEffect(() => {
    setCursorUiOpen('phone', isOpen)
    return () => setCursorUiOpen('phone', false)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // On attend une image avant de passer à l'état "visible" : sans ça, le
      // navigateur applique les deux états dans la même frame et n'anime rien.
      const frame = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(frame)
    }
    setShown(false)
    setSelected(0)
    const timer = setTimeout(() => setMounted(false), PHONE.animMs)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Clavier : P ouvre/ferme, Échap revient en arrière, flèches + Entrée naviguent.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const phone = usePhoneStore.getState()

      if (event.code === KEY.PHONE && !event.repeat) {
        phone.toggle()
        return
      }
      if (!phone.isOpen) return

      if (event.code === 'Escape') {
        phone.back()
        return
      }
      // Les flèches ne servent qu'à l'accueil : dans une app, on laisse le
      // défilement natif faire son travail.
      if (phone.appId) return

      const step: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: COLUMNS,
        ArrowUp: -COLUMNS,
      }
      if (event.code in step) {
        event.preventDefault() // sinon la page tente de défiler
        setSelected((current) => clampIndex(current + step[event.code]))
        return
      }
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        phone.openApp(PHONE_APPS[selected].id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected])

  if (!mounted) return null

  const app = findPhoneApp(appId)

  return (
    <div
      style={{
        position: 'fixed',
        right: riding ? EDGE_DRIVING : EDGE,
        bottom: EDGE,
        // Sorti de la poche : il monte et se redresse légèrement.
        transform: `${shown ? 'translateY(0) rotate(0deg)' : 'translateY(38px) rotate(4deg)'} scale(${scale})`,
        transformOrigin: 'bottom right',
        opacity: shown ? 1 : 0,
        transition: `right 200ms ease, transform ${PHONE.animMs}ms cubic-bezier(.2,.9,.3,1.2), opacity ${PHONE.animMs}ms ease`,
        pointerEvents: 'none', // seule la coque est cliquable (voir `shell`)
      }}
    >
      <div style={shell}>
        <div style={screen}>
          <Wallpaper />
          <StatusBar />

          {/* Contenu : soit l'accueil, soit l'application ouverte. */}
          <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
            {app ? (
              <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
                <AppHeader label={app.label} icon={app.icon} />
                {app.Screen ? <app.Screen /> : <ComingSoonApp app={app} />}
              </div>
            ) : (
              <PhoneHome selected={selected} onHover={setSelected} />
            )}
          </div>

          <HomeBar inApp={Boolean(app)} />
        </div>
      </div>
    </div>
  )
}

/** Fond d'écran : le ciel de Beauvais à l'heure qu'il est, en plus sombre. */
function Wallpaper() {
  const minute = useGameTimeStore((s) => Math.floor(s.totalMinutes))
  const sky = getSkyColors(minute)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(175deg, ${sky.top} 0%, ${sky.horizon} 62%, ${PHONE.screenBg} 100%)`,
        // Assombri pour que le texte blanc reste lisible en plein midi.
        opacity: 0.42,
        pointerEvents: 'none',
      }}
    />
  )
}

/** Barre d'état : heure du jeu à gauche, réseau et batterie à droite. */
function StatusBar() {
  const minute = useGameTimeStore((s) => Math.floor(s.totalMinutes))
  const phase = getDayPhaseLabel(getDayPhase(minute))

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 15px 5px',
        font: `800 11px ${PHONE.font}`,
      }}
    >
      <span>{formatGameTime(minute)}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: PHONE.textDim }}>
        <span style={{ font: `700 9px ${PHONE.font}` }}>{phase}</span>
        {/* Antenne : trois barres de réseau, décoratives. */}
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 9 }}>
          {[4, 6.5, 9].map((height) => (
            <span key={height} style={{ width: 2.5, height, borderRadius: 1, background: PHONE.text }} />
          ))}
        </span>
        {/* Batterie : DÉCORATIVE et pleine — il n'existe aucun système de
            batterie dans le jeu. Le jour où il en existera un, c'est ici que
            se branche le pourcentage (et pas ailleurs). */}
        <span
          style={{
            position: 'relative',
            width: 19,
            height: 9.5,
            borderRadius: 3,
            border: `1px solid ${PHONE.textDim}`,
            padding: 1.5,
          }}
        >
          <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 1, background: PHONE.text }} />
          <span
            style={{
              position: 'absolute',
              left: '100%',
              top: 2.5,
              width: 1.5,
              height: 3.5,
              borderRadius: '0 2px 2px 0',
              background: PHONE.textDim,
            }}
          />
        </span>
      </span>
    </div>
  )
}

/** En-tête d'une application : flèche retour + titre. */
function AppHeader({ label, icon }: { label: string; icon: string }) {
  const goHome = usePhoneStore((s) => s.goHome)
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px 10px',
      }}
    >
      <button
        type="button"
        onClick={goHome}
        title="Retour (Échap)"
        style={{
          width: 26,
          height: 26,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 999,
          border: PHONE.cardBorder,
          background: PHONE.card,
          color: PHONE.text,
          font: `900 14px ${PHONE.font}`,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ‹
      </button>
      <strong style={{ font: `900 14px ${PHONE.font}` }}>
        {icon} {label}
      </strong>
    </div>
  )
}

/** Barre du bas : le trait « accueil » d'un smartphone + le rappel des touches. */
function HomeBar({ inApp }: { inApp: boolean }) {
  const back = usePhoneStore((s) => s.back)
  return (
    <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 5, padding: '6px 0 9px' }}>
      <span style={{ font: `700 9px ${PHONE.font}`, color: PHONE.muted }}>
        {inApp ? 'Échap · retour' : 'P · ranger le téléphone'}
      </span>
      <button
        type="button"
        onClick={back}
        title={inApp ? 'Retour à l’accueil' : 'Ranger le téléphone'}
        style={{
          width: 96,
          height: 4,
          borderRadius: 999,
          border: 'none',
          background: 'rgba(226, 232, 240, 0.55)',
          cursor: 'pointer',
          padding: 0,
        }}
      />
    </div>
  )
}

/**
 * Sur une fenêtre basse (portable, écran 720p en fenêtré), un téléphone de 556 px
 * dépasserait de l'écran. On le rétrécit juste ce qu'il faut, depuis son coin bas
 * droit pour qu'il reste collé au bord.
 */
function usePhoneScale(): number {
  const compute = () => Math.min(1, (window.innerHeight - 2 * EDGE) / (PHONE.height + 2 * EDGE))
  const [scale, setScale] = useState(compute)

  useEffect(() => {
    const onResize = () => setScale(compute)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return scale
}

/** Garde l'index de sélection dans la grille (pas de saut hors de la liste). */
function clampIndex(index: number): number {
  return Math.min(PHONE_APPS.length - 1, Math.max(0, index))
}
