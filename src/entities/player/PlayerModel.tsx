import { useEffect, useMemo, useRef } from 'react'
import { useFBX, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { toonFromImported } from '../../shaders/toonMaterial'
import { usePlayerStore, type AttackMove, type PlayerAction } from '../../gameplay/stats/playerStore'
import { useScooterStore } from '../vehicles/scooterStore'
import { useCarStore } from '../vehicles/carStore'
import { getPlayerTuning, useDevTuningStore } from '../../devtools/devTuningStore'

const BASE = '/models/pierrot/'

const ANIMS: Record<string, string> = {
  idle: 'idle.fbx',
  walk: 'walk.fbx',
  sadWalk: 'Sad Walk.fbx',
  run: 'run.fbx',
  jump: 'jump.fbx',
  drive: 'drive.fbx',
  sit: 'sit.fbx',
  sneak: 'sneak.fbx',
  dance: 'dance.fbx',
  drunk1: 'drunk1.fbx',
  drunk2: 'drunk2.fbx',
  drunk3: 'drunk3.fbx',
  punch1: 'Punching.fbx',
  punch2: 'Punching(1).fbx',
  punch3: 'Punching(2).fbx',
  defense: 'DefenceGarde.fbx',
  hurt: 'Hurt.fbx',
}

const ACTION_TO_ANIM: Record<PlayerAction, string> = {
  idle: 'idle',
  walk: 'walk',
  sadWalk: 'sadWalk',
  run: 'run',
  attack: 'punch1',
  defense: 'defense',
  interact: 'idle',
  jump: 'jump',
  crouch: 'sneak',
  hurt: 'hurt',
}

// Quand le FBX d'arme existera, ajoute-le dans ANIMS, charge-le comme les autres,
// ajoute son clip a la liste, puis remplace `weapon: 'punch1'` par son nom.
const ATTACK_TO_ANIM: Record<AttackMove, string> = {
  punch1: 'punch1',
  punch2: 'punch2',
  punch3: 'punch3',
  weapon: 'punch1',
}

const UPPER_BODY_TRACK_PARTS = [
  'spine',
  'neck',
  'head',
  'shoulder',
  'arm',
  'forearm',
  'hand',
  'thumb',
  'index',
  'middle',
  'ring',
  'pinky',
]

const TARGET_HEIGHT = 1.75
const FACING = 0

export default function PlayerModel() {
  useDevTuningStore((s) => s.overrides)
  const playerTuning = getPlayerTuning()

  const character = useFBX(BASE + ANIMS.idle)
  const fbxWalk = useFBX(BASE + ANIMS.walk)
  const fbxSadWalk = useFBX(BASE + ANIMS.sadWalk)
  const fbxRun = useFBX(BASE + ANIMS.run)
  const fbxJump = useFBX(BASE + ANIMS.jump)
  const fbxDrive = useFBX(BASE + ANIMS.drive)
  const fbxSit = useFBX(BASE + ANIMS.sit)
  const fbxSneak = useFBX(BASE + ANIMS.sneak)
  const fbxDance = useFBX(BASE + ANIMS.dance)
  const fbxDrunk1 = useFBX(BASE + ANIMS.drunk1)
  const fbxDrunk2 = useFBX(BASE + ANIMS.drunk2)
  const fbxDrunk3 = useFBX(BASE + ANIMS.drunk3)
  const fbxPunch1 = useFBX(BASE + ANIMS.punch1)
  const fbxPunch2 = useFBX(BASE + ANIMS.punch2)
  const fbxPunch3 = useFBX(BASE + ANIMS.punch3)
  const fbxDefense = useFBX(BASE + ANIMS.defense)
  const fbxHurt = useFBX(BASE + ANIMS.hurt)

  const clips = useMemo(() => {
    const clip = (fbx: THREE.Group, name: string) => {
      const c = fbx.animations[0].clone()
      c.name = name
      c.tracks = c.tracks.filter(
        (track) => !(track.name.toLowerCase().includes('hips') && track.name.endsWith('.position')),
      )
      return c
    }

    const upperClip = (fbx: THREE.Group, name: string) => {
      const c = clip(fbx, name)
      c.tracks = c.tracks.filter((track) => {
        const lower = track.name.toLowerCase()
        return UPPER_BODY_TRACK_PARTS.some((part) => lower.includes(part))
      })
      return c
    }

    return [
      clip(character, 'idle'),
      clip(fbxWalk, 'walk'),
      clip(fbxSadWalk, 'sadWalk'),
      clip(fbxRun, 'run'),
      clip(fbxJump, 'jump'),
      clip(fbxDrive, 'drive'),
      clip(fbxSit, 'sit'),
      clip(fbxSneak, 'sneak'),
      clip(fbxDance, 'dance'),
      clip(fbxDrunk1, 'drunk1'),
      clip(fbxDrunk2, 'drunk2'),
      clip(fbxDrunk3, 'drunk3'),
      clip(fbxPunch1, 'punch1'),
      clip(fbxPunch2, 'punch2'),
      clip(fbxPunch3, 'punch3'),
      upperClip(fbxPunch1, 'punch1Upper'),
      upperClip(fbxPunch2, 'punch2Upper'),
      upperClip(fbxPunch3, 'punch3Upper'),
      clip(fbxDefense, 'defense'),
      clip(fbxHurt, 'hurt'),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character])

  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(clips, group)

  useEffect(() => {
    character.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.frustumCulled = false
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => toonFromImported(m))
        : toonFromImported(mesh.material)
    })
  }, [character])

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(character)
    const h = Math.max(0.001, box.max.y - box.min.y)
    const scale = TARGET_HEIGHT / h
    console.info('[Pierrot] taille brute:', box.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)), '-> echelle', scale.toFixed(3))
    const y = -playerTuning.BODY_HEIGHT - box.min.y * scale
    return { scale, y }
  }, [character, playerTuning.BODY_HEIGHT])

  const action = usePlayerStore((s) => s.action)
  const locomotionAction = usePlayerStore((s) => s.locomotionAction)
  const attackMove = usePlayerStore((s) => s.attackMove)
  const attackToken = usePlayerStore((s) => s.attackToken)
  const hurtToken = usePlayerStore((s) => s.hurtToken)
  const isRagdoll = usePlayerStore((s) => s.isRagdoll)
  const ridingScooter = useScooterStore((s) => s.riding)
  const ridingCar = useCarStore((s) => s.riding)
  const riding = ridingScooter || ridingCar

  const current = useRef('')
  const currentName = useRef('')
  const currentUpper = useRef('')
  const currentUpperName = useRef('')

  useEffect(() => {
    let name: string
    let oneShotDuration = 0
    if (riding) {
      name = 'drive'
    } else if (isRagdoll) {
      name = 'idle'
    } else if (action === 'hurt') {
      name = 'hurt'
      oneShotDuration = playerTuning.HURT_DURATION
    } else {
      const baseAction = action === 'attack' ? locomotionAction : action
      name = ACTION_TO_ANIM[baseAction] ?? 'idle'
    }

    const key = oneShotDuration === 0 ? name : `${name}#${hurtToken}`
    if (key === current.current) return
    const next = actions[name]
    if (!next) return

    const fade = oneShotDuration > 0 ? 0.08 : 0.2
    actions[currentName.current]?.fadeOut(fade)
    next.reset()
    if (oneShotDuration > 0) {
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = true
      next.setDuration(oneShotDuration)
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity)
      next.clampWhenFinished = false
      next.timeScale = 1
    }
    next.fadeIn(fade).play()
    current.current = key
    currentName.current = name
  }, [action, locomotionAction, hurtToken, riding, isRagdoll, actions, playerTuning])

  useEffect(() => {
    if (riding || isRagdoll || action === 'hurt' || !attackMove) {
      actions[currentUpperName.current]?.fadeOut(0.08)
      currentUpper.current = ''
      currentUpperName.current = ''
      return
    }

    const baseName = ATTACK_TO_ANIM[attackMove]
    const name = `${baseName}Upper`
    const key = `${name}#${attackToken}`
    if (key === currentUpper.current) return
    const next = actions[name]
    if (!next) return

    actions[currentUpperName.current]?.fadeOut(0.05)
    next.reset()
    next.setLoop(THREE.LoopOnce, 1)
    next.clampWhenFinished = true
    next.setDuration(getAttackDuration(attackMove, playerTuning))
    next.fadeIn(0.05).play()
    currentUpper.current = key
    currentUpperName.current = name
  }, [action, attackMove, attackToken, riding, isRagdoll, actions, playerTuning])

  return (
    <group ref={group} visible={!ridingCar && !isRagdoll} rotation={[0, FACING, 0]} position={[0, fit.y, 0]} scale={fit.scale}>
      <primitive object={character} />
    </group>
  )
}

function getAttackDuration(move: AttackMove, playerTuning: ReturnType<typeof getPlayerTuning>): number {
  if (move === 'weapon') return playerTuning.WEAPON_ATTACK_DURATION
  const index = Number(move.slice(-1)) - 1
  return playerTuning.COMBO_DURATIONS[index] ?? playerTuning.COMBO_DURATIONS[0]
}
