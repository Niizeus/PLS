/**
 * Mode bac a sable plat pour tester rapidement items, vehicules et physique.
 *
 * URL normale : Beauvais.
 * URL avec `?level=test` ou `?testLevel=1` : monde plat de test.
 */
export function isFlatTestLevelEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('level') === 'test' || params.get('testLevel') === '1'
}
