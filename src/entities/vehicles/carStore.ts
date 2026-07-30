import { create } from 'zustand'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import { SPAWN } from '../../world/beauvais/cityData'

export interface VehicleControlInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  /** Frein à main maintenu (Espace) : freine l'arrière et le fait décrocher. */
  handbrake: boolean
  /** Klaxon maintenu (F). */
  horn: boolean
}

interface CarPhysicsState {
  x: number
  y: number
  z: number
  rot: number
  driverX: number
  driverY: number
  driverZ: number
  pitch: number
  roll: number
  steer: number
  wheelSpin: number
  frontSuspension: number
  rearSuspension: number
  speed: number
  velocityX: number
  velocityY: number
  velocityZ: number
  rpm: number
  gear: number
}

interface CarState {
  riding: boolean
  parkedX: number
  parkedZ: number
  parkedRot: number
  physicsX: number
  physicsY: number
  physicsZ: number
  physicsRot: number
  driverX: number
  driverY: number
  driverZ: number
  visualPitch: number
  visualRoll: number
  visualSteer: number
  wheelSpin: number
  frontSuspension: number
  rearSuspension: number
  speed: number
  velocityX: number
  velocityY: number
  velocityZ: number
  rpm: number
  gear: number
  controls: VehicleControlInput
  physicsReleased: boolean
  fuelLiters: number
  fuelCapacityLiters: number
  /** Limiteur de vitesse (A) : actif ou non, et vitesse mémorisée (m/s). */
  limiterActive: boolean
  limiterSpeed: number
  /** Phares (L). */
  headlightsOn: boolean
  consumeFuel: (liters: number) => void
  setControls: (controls: VehicleControlInput) => void
  setControlsFromKeyboard: (keyboard: KeyboardState) => void
  setPhysicsState: (state: CarPhysicsState) => void
  /**
   * Bascule le limiteur. Premier appui = mémorise la vitesse ACTUELLE comme
   * plafond ; deuxième appui = coupe. En dessous de `minSpeed`, on refuse
   * d'enclencher (limiter à 3 km/h n'a aucun sens) et on renvoie `false`.
   */
  toggleLimiter: (minSpeed: number) => boolean
  toggleHeadlights: () => void
  mount: () => void
  parkAt: (x: number, z: number, rot: number) => void
}

const INITIAL_X = SPAWN.x - 4.5
const INITIAL_Z = SPAWN.z + 1.8
const INITIAL_ROT = Math.PI * 0.5
const EMPTY_CONTROLS: VehicleControlInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  horn: false,
}

export const useCarStore = create<CarState>((set, get) => ({
  riding: false,
  // Gares pres du spawn pour tester tout de suite la conduite voiture.
  parkedX: INITIAL_X,
  parkedZ: INITIAL_Z,
  parkedRot: INITIAL_ROT,
  physicsX: INITIAL_X,
  physicsY: 0,
  physicsZ: INITIAL_Z,
  physicsRot: INITIAL_ROT,
  driverX: INITIAL_X,
  driverY: 1.05,
  driverZ: INITIAL_Z,
  visualPitch: 0,
  visualRoll: 0,
  visualSteer: 0,
  wheelSpin: 0,
  frontSuspension: 0,
  rearSuspension: 0,
  speed: 0,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
  rpm: 800,
  gear: 1,
  controls: EMPTY_CONTROLS,
  physicsReleased: false,
  fuelLiters: 42,
  fuelCapacityLiters: 42,
  limiterActive: false,
  limiterSpeed: 0,
  headlightsOn: false,
  consumeFuel: (liters) => set((s) => ({ fuelLiters: Math.max(0, s.fuelLiters - liters) })),
  setControls: (controls) => set({ controls }),
  setControlsFromKeyboard: (keyboard) =>
    set({
      controls: {
        forward: keyboard.forward,
        backward: keyboard.backward,
        left: keyboard.left,
        right: keyboard.right,
        handbrake: keyboard.handbrake,
        horn: keyboard.horn,
      },
    }),
  toggleLimiter: (minSpeed) => {
    const state = get()
    if (state.limiterActive) {
      set({ limiterActive: false })
      return false
    }
    const speed = Math.abs(state.speed)
    if (speed < minSpeed) return false
    set({ limiterActive: true, limiterSpeed: speed })
    return true
  },
  toggleHeadlights: () => set((s) => ({ headlightsOn: !s.headlightsOn })),
  setPhysicsState: (state) =>
    set((current) => ({
      physicsX: state.x,
      physicsY: state.y,
      physicsZ: state.z,
      physicsRot: state.rot,
      parkedX: current.riding ? current.parkedX : state.x,
      parkedZ: current.riding ? current.parkedZ : state.z,
      parkedRot: current.riding ? current.parkedRot : state.rot,
      driverX: state.driverX,
      driverY: state.driverY,
      driverZ: state.driverZ,
      visualPitch: state.pitch,
      visualRoll: state.roll,
      visualSteer: state.steer,
      wheelSpin: state.wheelSpin,
      frontSuspension: state.frontSuspension,
      rearSuspension: state.rearSuspension,
      speed: state.speed,
      velocityX: state.velocityX,
      velocityY: state.velocityY,
      velocityZ: state.velocityZ,
      rpm: state.rpm,
      gear: state.gear,
    })),
  mount: () => set({ riding: true, physicsReleased: true }),
  parkAt: (x, z, rot) =>
    set({
      riding: false,
      parkedX: x,
      parkedZ: z,
      parkedRot: rot,
      physicsX: x,
      physicsZ: z,
      physicsRot: rot,
      controls: EMPTY_CONTROLS,
      physicsReleased: true,
      // On coupe le limiteur en descendant : le retrouver actif au prochain
      // démarrage serait une mauvaise surprise. Les phares, eux, restent —
      // une voiture garée peut très bien rester allumée.
      limiterActive: false,
      visualSteer: 0,
      frontSuspension: 0,
      rearSuspension: 0,
    }),
}))
