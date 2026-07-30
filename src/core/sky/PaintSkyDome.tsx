import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSkyTuning, useDevTuningStore } from '../../devtools/devTuningStore'
import {
  getCelestialCycle,
  writeMoonSkyPosition,
  writeSunSkyPosition,
} from '../../gameplay/time/celestialCycle'
import { useGameTimeStore } from '../../gameplay/time/gameTimeStore'
import { applySkyTuning, getSkyAtmosphere } from './skyAtmosphere'

const PAINT_SKY_RADIUS = 172

const VERTEX_SHADER = `
varying vec3 vSkyDirection;

void main() {
  vSkyDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;

uniform float uTime;
uniform float uOpacity;
uniform float uPrimaryScale;
uniform float uSecondaryScale;
uniform float uWarpStrength;
uniform float uShapeSoftness;
uniform float uHorizontalStretch;
uniform float uHorizonIntensity;
uniform float uZenithIntensity;
uniform float uSunHaloIntensity;
uniform float uMoonHaloIntensity;
uniform float uHorizonGlowIntensity;
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform vec3 uPaintA;
uniform vec3 uPaintB;
uniform vec3 uPaintC;
uniform vec3 uGlowColor;
uniform vec3 uSunDirection;
uniform vec3 uMoonDirection;

varying vec3 vSkyDirection;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  value += valueNoise(p) * amplitude;
  p = p * 2.03 + vec2(17.2, 4.7);
  amplitude *= 0.5;
  value += valueNoise(p) * amplitude;
  p = p * 2.01 + vec2(3.1, 24.3);
  amplitude *= 0.5;
  value += valueNoise(p) * amplitude;
  return value / 0.875;
}

float softBlob(vec2 p, vec2 center, float radius, float weight) {
  float dx = (p.x - center.x) / max(0.18, uHorizontalStretch);
  float dy = (p.y - center.y) * 1.55;
  float distanceField = sqrt(dx * dx + dy * dy);
  float blob = 1.0 - smoothstep(radius * 0.35, radius, distanceField);
  return blob * weight;
}

float paintField(vec2 p) {
  float drift = uTime * 0.006;
  float horizonPull = 1.0 - smoothstep(0.2, 0.82, p.y);
  vec2 warpP = p * (1.35 + uPrimaryScale * 0.45);
  vec2 warp = vec2(
    fbm(warpP + vec2(drift, 3.4)),
    fbm(warpP + vec2(7.1, -drift))
  ) - 0.5;
  vec2 q = p + warp * uWarpStrength * 0.18;

  float field = 0.0;
  field += softBlob(q, vec2(-0.74 + sin(drift * 0.12) * 0.06, 0.22 + horizonPull * 0.10), 0.34, 0.95);
  field += softBlob(q, vec2(-0.34 + cos(drift * 0.09) * 0.05, 0.44), 0.26, 0.72);
  field += softBlob(q, vec2(0.04 + sin(drift * 0.07) * 0.07, 0.28), 0.42, 1.0);
  field += softBlob(q, vec2(0.42 + cos(drift * 0.06) * 0.05, 0.6), 0.28, 0.62);
  field += softBlob(q, vec2(0.76 + sin(drift * 0.08) * 0.06, 0.36), 0.36, 0.84);

  float broad = fbm((q + vec2(drift * 0.4, -drift * 0.22)) * (1.45 + uPrimaryScale * 0.7));
  float detail = fbm((q + vec2(-drift * 0.18, drift * 0.31)) * (3.0 + uSecondaryScale * 1.1));
  field += broad * 0.5 + detail * 0.12;
  return field;
}

void main() {
  vec3 dir = normalize(vSkyDirection);
  float skyY = clamp((dir.y + 0.04) / 0.96, 0.0, 1.0);
  float horizonBand = pow(1.0 - skyY, 2.2);
  float zenithBand = pow(skyY, 1.35);

  vec2 skyUv = vec2(dir.x * 0.72, dir.z * 0.38 + skyY * 0.74);

  vec3 base = mix(uHorizonColor * uHorizonIntensity, uZenithColor * uZenithIntensity, smoothstep(0.02, 0.96, skyY));
  base += uGlowColor * horizonBand * 0.08 * uHorizonIntensity;

  vec2 flatDir = normalize(dir.xz + vec2(0.0001, 0.0001));
  vec2 flatSun = normalize(uSunDirection.xz + vec2(0.0001, 0.0001));
  float sunLow = (1.0 - smoothstep(0.28, 0.78, uSunDirection.y)) * smoothstep(-0.1, 0.18, uSunDirection.y);
  float sunHorizonAlign = smoothstep(0.62, 0.98, dot(flatDir, flatSun));
  float horizonGlow = horizonBand * sunHorizonAlign * sunLow * uSunHaloIntensity * uHorizonGlowIntensity;
  base += uGlowColor * horizonGlow * 0.42;
  base += uPaintA * horizonGlow * 0.12;

  float field = paintField(skyUv);
  float threshold = mix(0.86, 0.66, horizonBand);
  float softness = 0.08 + uShapeSoftness * 0.18;
  float paintMask = smoothstep(threshold, threshold + softness, field);
  paintMask *= smoothstep(0.0, 0.08, skyY);
  paintMask *= 1.0 - smoothstep(0.92, 1.0, skyY) * 0.32;

  float colorMix = fbm(skyUv * vec2(2.2, 1.1) + vec2(uTime * 0.0014, 2.0));
  vec3 paintColor = mix(uPaintA, uPaintB, smoothstep(0.18, 0.82, colorMix));
  paintColor = mix(paintColor, uPaintC, smoothstep(0.48, 0.96, skyY + field * 0.16));
  paintColor = mix(paintColor, uGlowColor, horizonBand * 0.18);

  float sunHalo = smoothstep(0.86, 0.998, dot(dir, normalize(uSunDirection))) * uSunHaloIntensity;
  float moonHalo = smoothstep(0.9, 0.998, dot(dir, normalize(uMoonDirection))) * uMoonHaloIntensity;
  vec3 halo = uGlowColor * sunHalo * 0.36 + mix(uPaintC, vec3(0.72, 0.82, 1.0), 0.55) * moonHalo * 0.2;

  vec3 color = mix(base, paintColor, clamp(paintMask * uOpacity, 0.0, 0.95));
  color += halo;
  color += uPaintB * horizonBand * paintMask * 0.08;
  color += uZenithColor * zenithBand * 0.03;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

export default function PaintSkyDome() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const skyOverrides = useDevTuningStore((state) => state.overrides.sky)
  const tuning = useMemo(() => getSkyTuning(), [skyOverrides])
  const scratch = useMemo(
    () => ({
      horizon: new THREE.Color(),
      zenith: new THREE.Color(),
      paintA: new THREE.Color(),
      paintB: new THREE.Color(),
      paintC: new THREE.Color(),
      glow: new THREE.Color(),
      sunDirection: new THREE.Vector3(),
      moonDirection: new THREE.Vector3(),
    }),
    [],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.7 },
      uPrimaryScale: { value: 1 },
      uSecondaryScale: { value: 1 },
      uWarpStrength: { value: 1 },
      uShapeSoftness: { value: 1 },
      uHorizontalStretch: { value: 1 },
      uHorizonIntensity: { value: 1 },
      uZenithIntensity: { value: 1 },
      uSunHaloIntensity: { value: 1 },
      uMoonHaloIntensity: { value: 1 },
      uHorizonGlowIntensity: { value: 1 },
      uHorizonColor: { value: new THREE.Color('#dff7ff') },
      uZenithColor: { value: new THREE.Color('#70b5eb') },
      uPaintA: { value: new THREE.Color('#fff3dc') },
      uPaintB: { value: new THREE.Color('#83ddea') },
      uPaintC: { value: new THREE.Color('#4c9fe0') },
      uGlowColor: { value: new THREE.Color('#fff7d6') },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDirection: { value: new THREE.Vector3(0, 1, 0) },
    }),
    [],
  )

  useFrame(() => {
    if (!mesh.current || !material.current) return
    const totalMinutes = useGameTimeStore.getState().totalMinutes
    const isEnabled = tuning.paint.enabled >= 0.5
    mesh.current.visible = isEnabled
    if (!isEnabled) return

    const cycle = getCelestialCycle(totalMinutes)
    const atmosphere = applySkyTuning(getSkyAtmosphere(totalMinutes), tuning)
    writeSunSkyPosition(totalMinutes, 1, scratch.sunDirection)
    writeMoonSkyPosition(totalMinutes, 1, scratch.moonDirection)

    material.current.uniforms.uTime.value = totalMinutes * atmosphere.animationSpeed
    material.current.uniforms.uOpacity.value = atmosphere.opacity
    material.current.uniforms.uPrimaryScale.value = atmosphere.primaryShapeScale
    material.current.uniforms.uSecondaryScale.value = atmosphere.secondaryShapeScale
    material.current.uniforms.uWarpStrength.value = atmosphere.warpStrength
    material.current.uniforms.uShapeSoftness.value = atmosphere.shapeSoftness
    material.current.uniforms.uHorizontalStretch.value = atmosphere.horizontalStretch
    material.current.uniforms.uHorizonIntensity.value = atmosphere.horizonIntensity
    material.current.uniforms.uZenithIntensity.value = atmosphere.zenithIntensity
    material.current.uniforms.uSunHaloIntensity.value = atmosphere.sunHaloIntensity * cycle.sunVisibility
    material.current.uniforms.uMoonHaloIntensity.value = atmosphere.moonHaloIntensity * cycle.moonVisibility
    material.current.uniforms.uHorizonGlowIntensity.value = atmosphere.horizonGlowStrength
    material.current.uniforms.uHorizonColor.value.copy(scratch.horizon.set(atmosphere.horizon))
    material.current.uniforms.uZenithColor.value.copy(scratch.zenith.set(atmosphere.zenith))
    material.current.uniforms.uPaintA.value.copy(scratch.paintA.set(atmosphere.paintA))
    material.current.uniforms.uPaintB.value.copy(scratch.paintB.set(atmosphere.paintB))
    material.current.uniforms.uPaintC.value.copy(scratch.paintC.set(atmosphere.paintC))
    material.current.uniforms.uGlowColor.value.copy(scratch.glow.set(atmosphere.glow))
    material.current.uniforms.uSunDirection.value.copy(scratch.sunDirection.normalize())
    material.current.uniforms.uMoonDirection.value.copy(scratch.moonDirection.normalize())
  })

  return (
    <mesh ref={mesh} renderOrder={-995} frustumCulled={false}>
      <sphereGeometry args={[PAINT_SKY_RADIUS, 48, 24]} />
      <shaderMaterial
        ref={material}
        attach="material"
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  )
}
