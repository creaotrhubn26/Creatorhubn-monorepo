/**
 * project-folder-structure.ts
 *
 * Oppretter mappestrukturen for et nytt prosjekt i CreatorHubs egen lagring.
 *
 * Bakgrunn: `frontend/shared/folder-configuration.ts` har vært sannhetskilden
 * for mappestruktur siden lenge, men bare mot Google Drive — og den er ikke
 * importert i backend i det hele tatt. Prosjekter opprettet i CreatorHub fikk
 * derfor ingen struktur i vår egen lagring; brukeren møtte et tomt rom.
 *
 * Object storage har ikke ekte mapper — «mappe» er et nøkkelprefiks. For at
 * strukturen skal være synlig FØR noen har lastet opp noe, skriver vi et tomt
 * markørobjekt per mappe. Det er standardmønsteret, og det er billig: åtte
 * nullbyte-objekter per prosjekt.
 *
 * DUPLISERING, BEVISST: mappelista speiles her i stedet for å importeres fra
 * frontend/shared. Backend har ingen byggvei dit (`@shared/*` peker på en
 * `backend/shared` som ikke finnes), og å wire opp en kryss-pakke-import i
 * esbuild-bygget er en større endring med deploy-risiko enn denne jobben
 * fortjener. `project-folder-structure.test.ts` leser frontend-fila fra disk
 * og feiler hvis listene skiller lag, så drift blir en rød test og ikke en
 * stille divergens.
 */

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getRoleRoomObjectStorage, resolveRoleRoomObjectKey } from "./role-room-object-storage.js";

export interface ProjectFolder {
  id: string;
  name: string;
}

/**
 * Kjernestrukturen — kategori 'default' i MASTER_FOLDER_CONFIG.
 * Alle profesjoner, alle planer. Rekkefølgen er nummerert i id-en fordi
 * object storage sorterer leksikalsk.
 */
export const DEFAULT_PROJECT_FOLDERS: ProjectFolder[] = [
  { id: "01_Raw", name: "Raw" },
  { id: "02_Edited", name: "Edited" },
  { id: "03_Proofing", name: "Proofing" },
  { id: "04_Deliverables", name: "Deliverables" },
  { id: "05_Archive", name: "Archive" },
  { id: "06_Client_Communication", name: "Client Communication" },
  { id: "07_Project_Documents", name: "Project Documents" },
  { id: "08_Showcase", name: "Showcase" },
];

/** Nøkkelprefikset et prosjekt eier i lagringen. */
export function projectStoragePrefix(userId: string, projectId: string): string {
  return `projects/${userId}/${projectId}`;
}

export interface CreateFolderStructureResult {
  created: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Skriver markørobjektene som utgjør mappestrukturen.
 *
 * Kaster aldri. Prosjektet er allerede opprettet når denne kalles, og en
 * lagringshikke skal ikke velte opprettelsen — samme lærdom som da
 * berikelsen blokkerte at opprettelsesdialogen lukket seg.
 */
export async function createProjectFolderStructure(
  userId: string,
  projectId: string,
  folders: ProjectFolder[] = DEFAULT_PROJECT_FOLDERS,
): Promise<CreateFolderStructureResult> {
  if (!userId || !projectId) {
    return { created: [], skipped: true, reason: "mangler userId eller projectId" };
  }

  const storage = getRoleRoomObjectStorage();
  if (!storage) {
    // Lokalt/i test er lagring ofte ikke konfigurert. Det er ikke en feil.
    return { created: [], skipped: true, reason: "objektlagring ikke konfigurert" };
  }

  const prefix = projectStoragePrefix(userId, projectId);
  const created: string[] = [];

  for (const folder of folders) {
    const key = resolveRoleRoomObjectKey(`${prefix}/${folder.id}/.keep`);
    try {
      await storage.client.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: key,
          Body: "",
          ContentType: "application/x-directory-marker",
          Metadata: { folder: folder.name, project: projectId },
        }),
      );
      created.push(folder.id);
    } catch (err) {
      // Én mappe som feiler skal ikke stoppe de andre.
      console.warn(
        `[project-folders] kunne ikke opprette ${folder.id} for prosjekt ${projectId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { created, skipped: false };
}
