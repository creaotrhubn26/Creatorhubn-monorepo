// This must remain the only eager application import. It consumes and deletes
// the one-shot head bridge before either bootstrap branch loads dependencies.
import { isWorkspaceParticipantDocumentPath } from "./lib/workspaceParticipantDocumentCredential";

const privateParticipantDocument = isWorkspaceParticipantDocumentPath(
  window.location.pathname,
);

void (
  privateParticipantDocument
    ? import("./participant-document-entry")
    : import("./main-app")
).catch(() => {
  const root = document.getElementById("root");
  if (root) {
    root.textContent = privateParticipantDocument
      ? "Dokumentet kunne ikke lastes. Be prosjektansvarlig om en ny lenke."
      : "CreatorHub kunne ikke lastes. Oppdater siden og prøv igjen.";
  }
});
