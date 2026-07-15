/**
 * CH-ARCH-003 — Krev en <ErrorBoundary> over hver <Suspense>-grense.
 *
 * Bakgrunn: en `React.lazy`-komponent som suspenderer under en SYNKRON
 * state-oppdatering (fane-bytte fra klikk/⌘K/input) kaster React #426; uten en
 * ErrorBoundary over Suspense-grensen propagerer kastet forbi og BLANKER hele
 * flaten (whitescreen). Samme gjelder om lazy-chunken feiler å laste. Fiksen som
 * er rullet ut i PR #1470–#1474 er: co-lokaliser en `<ErrorBoundary>` (helst
 * keyet på fane/rute for auto-recovery) over Suspense-/lazy-innholdet.
 *
 * Regelen flagger enhver <Suspense>/<React.Suspense> som IKKE har en
 * *ErrorBoundary-forelder i samme fil*. Konvensjonen i denne kodebasen er å
 * plassere boundaryen sammen med Suspense/fane-innholdet, så same-file-sjekken
 * treffer det faktiske mønsteret. Ligger boundaryen bevisst i en foreldre-/
 * komponerende fil, silence med `// eslint-disable-next-line
 * ch-arch/require-error-boundary-on-suspense` + en kort begrunnelse.
 */

/** Navnet på et JSX-element: JSXIdentifier ("Suspense") el. JSXMemberExpression ("React.Suspense"). */
function jsxName(openingElement) {
  const n = openingElement && openingElement.name;
  if (!n) return '';
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXMemberExpression') {
    const obj = n.object && n.object.name ? n.object.name : '';
    const prop = n.property && n.property.name ? n.property.name : '';
    return `${obj}.${prop}`;
  }
  return '';
}

const SUSPENSE_NAMES = new Set(['Suspense', 'React.Suspense']);
// Matcher både "ErrorBoundary" og "Foo.ErrorBoundary" (member-uttrykk).
const BOUNDARY_RE = /ErrorBoundary$/;

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Krev en ErrorBoundary-forelder for hver Suspense-grense (CH-ARCH-003).',
      recommended: false,
    },
    schema: [],
    messages: {
      missingBoundary:
        'Denne <{{name}}> mangler en <ErrorBoundary>-forelder i samme fil. Lazy/suspenderende innhold uten boundary blanker hele flaten ved krasj (React #426) eller ved feilet chunk-lasting. Wrap i <ErrorBoundary> (keyet på fane/rute for auto-recovery) — se PR #1470–#1474. Ligger boundaryen bevisst i en foreldre-fil, silence med eslint-disable-next-line + begrunnelse.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = jsxName(node);
        if (!SUSPENSE_NAMES.has(name)) return;

        // Gå oppover JSX-forfedrene i samme fil og se etter et element som
        // heter *ErrorBoundary. node.parent er Suspense-elementet selv (navn
        // matcher ikke boundary-regexen), så vi starter trygt der.
        let cur = node.parent;
        while (cur) {
          if (cur.type === 'JSXElement' && cur.openingElement) {
            if (BOUNDARY_RE.test(jsxName(cur.openingElement))) {
              return; // beskyttet av en boundary-forelder i samme fil
            }
          }
          cur = cur.parent;
        }

        context.report({ node, messageId: 'missingBoundary', data: { name } });
      },
    };
  },
};
