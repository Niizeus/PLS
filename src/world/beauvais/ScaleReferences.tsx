import { Outlines } from '@react-three/drei'
import { toonGradient } from '../../shaders/toonGradient'
import { SPAWN } from './cityData'
import { groundHeight } from './roadway'

const CAR_SPOT = {
  x: SPAWN.x - 4.5,
  z: SPAWN.z + 1.8,
  rot: Math.PI * 0.5,
}

/** Petits objets fixes pour verifier l'echelle humaine pres du spawn. */
export default function ScaleReferences() {
  return (
    <>
      <ParkingBay x={CAR_SPOT.x} z={CAR_SPOT.z} rot={CAR_SPOT.rot} />
      <Bollard x={SPAWN.x - 7.1} z={SPAWN.z - 1.2} />
      <Bollard x={SPAWN.x - 7.1} z={SPAWN.z + 0.4} />
      <HeightPost x={SPAWN.x - 7.1} z={SPAWN.z + 2.2} />
    </>
  )
}

function ParkingBay({ x, z, rot }: { x: number; z: number; rot: number }) {
  const y = groundHeight(x, z) + 0.035
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <BayLine position={[0, 0, 2.35]} args={[2.35, 0.035, 0.08]} />
      <BayLine position={[0, 0, -2.35]} args={[2.35, 0.035, 0.08]} />
      <BayLine position={[-1.18, 0, 0]} args={[0.08, 0.035, 4.75]} />
      <BayLine position={[1.18, 0, 0]} args={[0.08, 0.035, 4.75]} />
    </group>
  )
}

function BayLine({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={args} />
      <meshToonMaterial color="#f1e7b8" gradientMap={toonGradient} />
    </mesh>
  )
}

function Bollard({ x, z }: { x: number; z: number }) {
  const y = groundHeight(x, z)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.9, 12]} />
        <meshToonMaterial color="#e6d35b" gradientMap={toonGradient} />
        <Outlines thickness={0.025} color="#171717" />
      </mesh>
      <mesh position={[0, 0.73, 0]} castShadow>
        <cylinderGeometry args={[0.125, 0.125, 0.09, 12]} />
        <meshToonMaterial color="#273044" gradientMap={toonGradient} />
      </mesh>
    </group>
  )
}

function HeightPost({ x, z }: { x: number; z: number }) {
  const y = groundHeight(x, z)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.875, 0]} castShadow>
        <boxGeometry args={[0.12, 1.75, 0.12]} />
        <meshToonMaterial color="#f4f0df" gradientMap={toonGradient} />
        <Outlines thickness={0.025} color="#171717" />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <boxGeometry args={[0.72, 0.06, 0.1]} />
        <meshToonMaterial color="#273044" gradientMap={toonGradient} />
      </mesh>
    </group>
  )
}


