/// <reference types="vite/client" />

/**
 * Catalogue radio genere par `vite/radioManifestPlugin.ts` a partir du contenu reel
 * de `public/musique/radio/`. Module virtuel : il n'existe aucun fichier a cet emplacement.
 */
declare module 'virtual:pls-radio-manifest' {
  import type { RadioManifestStation } from '../vite/radioManifestPlugin'
  export const RADIO_MANIFEST: RadioManifestStation[]
  export default RADIO_MANIFEST
}
