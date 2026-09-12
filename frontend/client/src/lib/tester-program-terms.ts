/**
 * Compatibility entrypoint for prototype-tester program terms.
 * The canonical agreement bundle lives in frontend/shared so the public
 * acceptance page and the backend persist exactly the same document text.
 */

export {
  PROGRAM_TERMS_VERSION,
  TESTER_PROGRAM_TERMS,
  programTermsAsText,
  programTermsShortSummary,
} from "@shared/prototype-tester-agreements";

export type TesterProgramTerms =
  typeof import("@shared/prototype-tester-agreements").TESTER_PROGRAM_TERMS;
