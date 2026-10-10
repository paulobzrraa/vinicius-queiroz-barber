/**
 * Tokens de movimento. Valores em segundos, como o Motion espera.
 * As curvas espelham --ease-out, --ease-in-out e --ease-drawer, e as durações
 * espelham --duration-*, em src/styles/tokens.css.
 */

export const easing = {
  /** Entradas e respostas da interface: começa rápido e assenta suave. */
  out: [0.23, 1, 0.32, 1],
  /** Algo que se desloca de um ponto a outro da tela. */
  inOut: [0.77, 0, 0.175, 1],
  /** Gavetas e painéis, como o menu mobile. */
  drawer: [0.32, 0.72, 0, 1],
} as const

export const duration = {
  /** Resposta ao toque, como o botão pressionado. */
  press: 0.16,
  /** Troca de cor no hover. */
  hover: 0.2,
  /** Movimento de interface (menus, painéis). Interface fica abaixo de 300ms. */
  ui: 0.25,
  /** Entrada de conteúdo durante a rolagem. */
  reveal: 0.7,
} as const

/** Deslocamento vertical das entradas, em px. */
export const revealOffset = 24

/** Intervalo entre itens em animações sequenciais (de 30 a 80ms). */
export const staggerInterval = 0.06

/** Selo de status (check/X): quanto o anel leva para se desenhar, e quando o conteúdo ao lado começa a entrar. */
export const sealDraw = 0.55
export const sealContentDelay = 0.9
