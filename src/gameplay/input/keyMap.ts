/**
 * Carte des touches du jeu.
 *
 * ⚠️ Astuce clavier importante : on utilise `event.code` (la POSITION physique
 * de la touche) et PAS `event.key` (la lettre imprimée). Résultat : sur un
 * clavier AZERTY, les touches Z Q S D sont physiquement aux positions
 * W A S D d'un clavier QWERTY. Donc `KeyW` = la touche "Z" en AZERTY, etc.
 * → Nos joueurs français ont bien du ZQSD sans qu'on ait à détecter la langue.
 */

export const KEY = {
  FORWARD: 'KeyW', // Z sur AZERTY
  BACKWARD: 'KeyS', // S
  LEFT: 'KeyA', // Q sur AZERTY
  RIGHT: 'KeyD', // D
  RUN: 'ShiftLeft', // Maj = courir
  INTERACT: 'KeyE', // E = action / interagir
  INVENTORY: 'KeyI', // I = inventaire
  INVENTORY_ALT: 'Tab', // Tab = inventaire aussi (le réflexe de tout le monde)
  RADIO_NEXT: 'KeyR', // R = station de radio suivante (en véhicule)
  PHONE: 'KeyP', // P = sortir / ranger le téléphone (P comme Phone, même touche en AZERTY)
  CONTROLS: 'F1', // F1 = déplier/replier le rappel des touches
  QUICK_1: 'Digit1', // 1 = raccourci inventaire
  QUICK_2: 'Digit2', // 2 = raccourci inventaire
  QUICK_3: 'Digit3', // 3 = raccourci inventaire
  QUICK_4: 'Digit4', // 4 = raccourci inventaire
  JUMP: 'Space', // Espace = sauter
  CROUCH: 'ControlLeft', // Ctrl = s'accroupir

  // --- Commandes véhicule (ignorées à pied) ---
  /**
   * Limiteur de vitesse = la touche **A** d'un clavier AZERTY.
   *
   * ⚠️ Piège : `event.code` décrit la POSITION physique de la touche sur un
   * clavier QWERTY. Le "A" imprimé sur un AZERTY se trouve à la place du "Q"
   * QWERTY → son code est donc `KeyQ`, et surtout PAS `KeyA` (qui est le "Q"
   * de l'AZERTY, déjà pris par `LEFT`). Même logique que ZQSD ci-dessus.
   */
  VEHICLE_LIMITER: 'KeyQ', // A sur AZERTY
  /** Frein à main. Espace ne sert pas à sauter quand on conduit. */
  VEHICLE_HANDBRAKE: 'Space',
  VEHICLE_HORN: 'KeyF', // F (même position en AZERTY et QWERTY)
  VEHICLE_LIGHTS: 'KeyL', // L (même position en AZERTY et QWERTY)
} as const

// Boutons de la souris (event.button) : 0 = gauche, 2 = droit.
export const MOUSE = {
  ATTACK: 0, // clic gauche = attaque
  DEFENSE: 2, // clic droit = défense
} as const
