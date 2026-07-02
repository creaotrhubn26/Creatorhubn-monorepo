import { google } from 'googleapis';

/**
 * apps-script-service.ts — fester en container-bundet Google Apps Script på en
 * Drive-fil (typisk et generert leveranse-Sheet), slik at kunden får en
 * «CreatorHub»-meny med auto-formatering + status-makroer direkte i regnearket.
 *
 * Bruker Apps Script API-et (`script.googleapis.com`) via `projects.create` +
 * `projects.updateContent`. Dette er hvor scopene `script.projects` og
 * `drive.scripts` faktisk utøves — appen oppretter og skriver innhold til et
 * Apps Script-prosjekt bundet til Drive-fila.
 */

type WorkspaceOauthClient = InstanceType<typeof google.auth.OAuth2>;

export type AppsScriptAttachResult = {
  success: true;
  scriptId: string;
  parentId: string;
  webViewLink: string;
};

// Kjøretids-manifest for det bundne skriptet.
const DEFAULT_MANIFEST = {
  timeZone: 'Europe/Oslo',
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
};

// Makro-koden som legges inn i leveranse-arket. Gir en CreatorHub-meny med
// auto-formatering av leveranseraden + rask «marker som levert»-handling.
const DEFAULT_MACRO_SOURCE = `/**
 * CreatorHub — auto-generert leveranse-automatisering.
 * Legger til en meny i regnearket for konsistent formatering og statusstyring.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CreatorHub')
    .addItem('Formater leveranseark', 'formatDeliverables')
    .addItem('Marker markert rad som levert', 'markDelivered')
    .addToUi();
}

function formatDeliverables() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getDataRange();
  range.setFontFamily('Inter');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  header.setBackground('#ff8c00').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, sheet.getLastColumn());
}

function markDelivered() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) return;
  const statusCol = sheet.getLastColumn();
  sheet.getRange(row, statusCol).setValue('Levert ' + new Date().toLocaleDateString('nb-NO'));
  sheet.getRange(row, 1, 1, statusCol).setBackground('#e8f5e9');
}
`;

/**
 * Oppretter et container-bundet Apps Script-prosjekt på `parentFileId` og
 * skriver leveranse-makroene inn i det.
 */
export async function attachDeliverableAutomationScript(
  oauthClient: WorkspaceOauthClient,
  parentFileId: string,
  options?: {
    title?: string;
    manifest?: Record<string, unknown>;
    macroSource?: string;
  },
): Promise<AppsScriptAttachResult> {
  if (!parentFileId || parentFileId.trim().length === 0) {
    throw new Error('Mangler Drive-fil-ID som Apps Script-prosjektet skal festes på.');
  }

  const scriptApi = (google as any).script({ version: 'v1', auth: oauthClient });

  // Container-bundet prosjekt (parentId = Drive-fila) — krever drive.scripts.
  const created = await scriptApi.projects.create({
    requestBody: {
      title: options?.title ?? 'CreatorHub Leveranse-automatisering',
      parentId: parentFileId,
    },
  });

  const scriptId: string | null =
    typeof created?.data?.scriptId === 'string' ? created.data.scriptId : null;
  if (!scriptId) {
    throw new Error('Apps Script-prosjektet ble ikke opprettet (mangler scriptId).');
  }

  // Skriv manifest + makro-kode — krever script.projects.
  await scriptApi.projects.updateContent({
    scriptId,
    requestBody: {
      files: [
        {
          name: 'appsscript',
          type: 'JSON',
          source: JSON.stringify(options?.manifest ?? DEFAULT_MANIFEST),
        },
        {
          name: 'Code',
          type: 'SERVER_JS',
          source: options?.macroSource ?? DEFAULT_MACRO_SOURCE,
        },
      ],
    },
  });

  return {
    success: true,
    scriptId,
    parentId: parentFileId,
    webViewLink: `https://script.google.com/d/${scriptId}/edit`,
  };
}
