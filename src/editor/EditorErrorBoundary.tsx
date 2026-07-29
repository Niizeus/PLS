import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 🛟 Filet de securite de l'editeur.
 *
 * Quand une erreur JavaScript survient pendant un rendu React, React demonte TOUT
 * l'arbre par securite : l'editeur disparait et il ne reste qu'une page blanche, sans
 * le moindre indice sur ce qui a casse. C'est exactement ce qui se passait quand on
 * renommait un point (voir le commentaire de `updateSelectedMarker` dans EditorApp.tsx).
 *
 * Ce composant intercepte l'erreur et affiche a la place le message, le fichier et la
 * pile d'appels, avec un bouton pour recharger. Le bug n'est pas repare pour autant,
 * mais on sait immediatement quoi corriger au lieu de fixer un ecran vide.
 *
 * ⚠️ Un ErrorBoundary n'attrape QUE les erreurs de rendu React. Les erreurs dans un
 * `setTimeout`, un `requestAnimationFrame` (la boucle de dessin du canvas) ou un
 * `fetch` passent a cote : elles restent visibles dans la console du navigateur (F12).
 */

interface EditorErrorBoundaryProps {
  children: ReactNode
}

interface EditorErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

export default class EditorErrorBoundary extends Component<EditorErrorBoundaryProps, EditorErrorBoundaryState> {
  state: EditorErrorBoundaryState = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<EditorErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // On garde la trace dans la console : c'est la que la source-map donne la vraie ligne.
    console.error('[editeur PLS] plantage attrape par EditorErrorBoundary', error, info)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div className="editor-crash">
        <h1>L&apos;editeur a plante</h1>
        <p>
          Une erreur est survenue pendant l&apos;affichage. Tes modifications non sauvegardees sont perdues :
          recharge la page pour repartir du dernier etat enregistre sur le disque.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Recharger l&apos;editeur
        </button>
        <h2>Detail technique</h2>
        <pre>
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
          {componentStack ? `\n\nComposants :${componentStack}` : ''}
        </pre>
        <p className="editor-crash-hint">
          Copie ce bloc si tu veux qu&apos;on corrige le bug : il dit quel fichier et quelle ligne ont casse.
        </p>
      </div>
    )
  }
}
