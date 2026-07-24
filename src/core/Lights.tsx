/**
 * Éclairage de la scène, pensé "cartoon" : lumière franche + remplissage doux.
 * - hemisphereLight : lumière d'ambiance (ciel clair / sol sombre), gratuite en perf.
 * - directionalLight : le "soleil", seule source qui projette des ombres.
 * - ambientLight : petit fond pour que les zones sombres ne soient pas noires.
 */
export default function Lights() {
  return (
    <>
      <hemisphereLight args={['#cfe8ff', '#5a4a3a', 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={2.2}
        castShadow
        // Résolution de la texture d'ombre : 2048 = net sans trop coûter.
        shadow-mapSize={[2048, 2048]}
        // Zone couverte par les ombres (plus c'est serré, plus c'est net).
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={1}
        shadow-camera-far={50}
        // Corrige le "shadow acne" (moiré) sur les surfaces plates.
        shadow-bias={-0.0004}
      />
    </>
  )
}
