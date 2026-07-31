import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * ⚙️ LES PARAMÈTRES DU JOUEUR.
 *
 * C'est le système qui manquait : jusqu'ici le seul endroit où régler quoi que
 * ce soit était le panneau **DEV `F2`**, qui n'est pas un menu d'options (il
 * expose des constantes de gameplay et n'existe qu'en développement).
 *
 * ── Les trois règles de ce fichier ──────────────────────────────────────────
 *
 * 1. **Il ne contient que des réglages de CONFORT** (son, image, souris). Aucun
 *    équilibrage de gameplay : ça, c'est `devtools/` et ça ne se règle pas en
 *    jeu.
 * 2. **Un réglage n'existe ici que s'il agit vraiment.** Pas de curseur
 *    décoratif « pour plus tard » : une option qui ne fait rien est pire que
 *    pas d'option.
 * 3. **Il est sauvegardé** (`localStorage`) : on ne rerègle pas son volume à
 *    chaque lancement.
 *
 * L'interface qui l'expose est l'app **Réglages du téléphone**
 * (`ui/phone/apps/SettingsApp.tsx`). Le jour où il y aura un menu pause, il
 * lira exactement ce même store.
 *
 * ⚠️ **Le volume de la radio n'est PAS ici** : il vit déjà dans
 * `audio/radioStore.ts`, avec le reste de l'état radio. Le dupliquer serait le
 * meilleur moyen d'avoir deux volumes qui divergent. Le volume général défini
 * ici s'applique **par-dessus** (voir `getRadioOutputVolume`).
 */

export interface PlayerSettings {
  /** Volume général, appliqué par-dessus tous les autres (0 → 1). */
  masterVolume: number
  /** Bruitages : téléphone, klaxon... (0 → 1). */
  sfxVolume: number
  /** Luminosité de l'image (0.6 = sombre, 1 = normal, 1.4 = clair). */
  brightness: number
  /** Multiplicateur de sensibilité souris (0.4 → 2.5, 1 = réglage d'origine). */
  mouseSensitivity: number
  /** Axe vertical de la caméra inversé ? */
  invertY: boolean
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  masterVolume: 1,
  sfxVolume: 0.8,
  brightness: 1,
  mouseSensitivity: 1,
  invertY: false,
}

/** Bornes des curseurs. Elles servent à l'interface ET au garde-fou du store. */
export const SETTINGS_RANGE = {
  masterVolume: { min: 0, max: 1 },
  sfxVolume: { min: 0, max: 1 },
  brightness: { min: 0.6, max: 1.4 },
  mouseSensitivity: { min: 0.4, max: 2.5 },
} as const

interface SettingsState extends PlayerSettings {
  /** Change un réglage. La valeur est bornée ici, pas dans l'interface. */
  set: <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => void
  resetSettings: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      set: (key, value) =>
        set(() => {
          // On borne ICI : comme ça, une valeur bizarre venue d'une vieille
          // sauvegarde ou d'un futur menu ne peut pas casser le jeu.
          if (typeof value === 'number' && key in SETTINGS_RANGE) {
            const range = SETTINGS_RANGE[key as keyof typeof SETTINGS_RANGE]
            return { [key]: clamp(value, range.min, range.max) } as Partial<PlayerSettings>
          }
          return { [key]: value } as Partial<PlayerSettings>
        }),

      resetSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'pls-settings',
      partialize: (state) => ({
        masterVolume: state.masterVolume,
        sfxVolume: state.sfxVolume,
        brightness: state.brightness,
        mouseSensitivity: state.mouseSensitivity,
        invertY: state.invertY,
      }),
    },
  ),
)

/**
 * Volume réellement appliqué à un bruitage.
 *
 * À appeler au MOMENT de jouer le son (et pas à la création du module) : le
 * joueur peut bouger le curseur entre deux sons.
 */
export function getSfxVolume(): number {
  const { masterVolume, sfxVolume } = useSettingsStore.getState()
  return masterVolume * sfxVolume
}
