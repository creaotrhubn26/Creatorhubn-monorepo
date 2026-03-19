import type {
  RoleRoomGoogleArtifactRef,
} from '../models/casting';
import type {
  ProjectAgreement,
} from './castingApiService';
import type { ProducerDeliveryManifest } from '../utils/producerProjectPlanning';

export interface ProducerDeliveryWorkspaceFile {
  key: string;
  file: File;
  metadata: Record<string, unknown>;
}

export interface ProducerDeliveryWorkspaceBuildResult {
  packageName: string;
  files: ProducerDeliveryWorkspaceFile[];
  generatedAtIso: string;
}

const hasText = (value: string | null | undefined): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const sanitizeFileToken = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'leveranse'
);

const asJsonBlob = (value: unknown): Blob => new Blob(
  [JSON.stringify(value, null, 2)],
  { type: 'application/json' },
);

class ProducerDeliveryWorkspaceService {
  buildWorkspaceFiles(
    projectId: string,
    projectName: string,
    manifest: ProducerDeliveryManifest,
    options?: {
      generatedAt?: Date;
      agreements?: ProjectAgreement[];
      googleArtifacts?: RoleRoomGoogleArtifactRef[];
    },
  ): ProducerDeliveryWorkspaceBuildResult {
    const generatedAt = options?.generatedAt ?? new Date();
    const generatedAtIso = generatedAt.toISOString();
    const packageName = `${sanitizeFileToken(projectName)}-leveransearbeidsomrade`;
    const files: ProducerDeliveryWorkspaceFile[] = [];
    const agreements = Array.isArray(options?.agreements) ? options?.agreements : [];
    const googleArtifacts = Array.isArray(options?.googleArtifacts) ? options?.googleArtifacts : [];

    const addTextFile = (
      key: string,
      name: string,
      content: string,
      metadata: Record<string, unknown>,
    ) => {
      files.push({
        key,
        file: new File([content], name, {
          type: 'text/plain;charset=utf-8',
          lastModified: generatedAt.getTime(),
        }),
        metadata,
      });
    };

    const addJsonFile = (
      key: string,
      name: string,
      payload: unknown,
      metadata: Record<string, unknown>,
    ) => {
      files.push({
        key,
        file: new File([asJsonBlob(payload)], name, {
          type: 'application/json',
          lastModified: generatedAt.getTime(),
        }),
        metadata,
      });
    };

    addJsonFile(
      'workspace-manifest',
      `${packageName}-manifest.json`,
      {
        projectId,
        projectName,
        packageName,
        generatedAt: generatedAtIso,
        deliveryItems: manifest.deliveryItems,
      },
      {
        source: 'role_room_delivery_workspace',
        workspaceType: 'workspace_manifest',
        packageName,
        folderPath: 'delivery-workspace/oversikt',
        generatedAt: generatedAtIso,
      },
    );

    addTextFile(
      'workspace-readme',
      `${packageName}-lesmeg.txt`,
      [
        `Prosjekt: ${projectName}`,
        `Generert: ${generatedAtIso}`,
        `Leveranser: ${manifest.deliveryItems.length}`,
        '',
        'Denne filpakken beskriver leveransearbeidsområdet for prosjektet.',
        'Hver leveranse har egne prosjektfiler med mappe, pakke, versjon og leveringsstatus.',
      ].join('\n'),
      {
        source: 'role_room_delivery_workspace',
        workspaceType: 'workspace_readme',
        packageName,
        folderPath: 'delivery-workspace/oversikt',
        generatedAt: generatedAtIso,
      },
    );

    manifest.deliveryItems.forEach((item, index) => {
      const deliveryKey = `${item.id}-${index}`;
      const safeName = sanitizeFileToken(item.packageName || item.title || `leveranse-${index + 1}`);
      const folderPath = hasText(item.folderPath) ? item.folderPath : 'delivery-workspace/ukategorisert';

      addTextFile(
        `${deliveryKey}-readme`,
        `${safeName}-brief.txt`,
        [
          `Leveranse: ${item.title}`,
          `Kanal: ${item.channel}`,
          `Format: ${item.format}`,
          `Målfil: ${item.filename}`,
          `Mappe: ${folderPath}`,
          `Pakke: ${item.packageName}`,
          `Versjon: ${item.versionLabel}`,
          `Leveringstrinn: ${item.deliveryStageLabel}`,
          `Publisering: ${item.publishDateLabel || 'Ikke satt'}`,
          item.estimatedDurationLabel ? `Estimert lengde: ${item.estimatedDurationLabel}` : 'Estimert lengde: Ikke beregnet',
          item.notes ? `Notat: ${item.notes}` : 'Notat: Ingen notater.',
        ].join('\n'),
        {
          source: 'role_room_delivery_workspace',
          workspaceType: 'delivery_readme',
          deliveryItemId: item.id,
          deliveryTitle: item.title,
          folderPath,
          packageName: item.packageName,
          versionLabel: item.versionLabel,
          deliveryStageLabel: item.deliveryStageLabel,
          publishDateLabel: item.publishDateLabel || '',
          linkedShotListId: item.linkedShotListId || '',
          generatedAt: generatedAtIso,
        },
      );

      addJsonFile(
        `${deliveryKey}-json`,
        `${safeName}.delivery.json`,
        item,
        {
          source: 'role_room_delivery_workspace',
          workspaceType: 'delivery_manifest_item',
          deliveryItemId: item.id,
          deliveryTitle: item.title,
          folderPath,
          packageName: item.packageName,
          versionLabel: item.versionLabel,
          deliveryStageLabel: item.deliveryStageLabel,
          publishDateLabel: item.publishDateLabel || '',
          linkedShotListId: item.linkedShotListId || '',
          generatedAt: generatedAtIso,
        },
      );
    });

    agreements.forEach((agreement, index) => {
      const agreementKey = `${agreement.id}-${index}`;
      const safeName = sanitizeFileToken(agreement.title || `juridisk-dokument-${index + 1}`);
      const signedPdfArtifact = googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.signedPdfArtifactId);
      const pdfSnapshotArtifact = googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.pdfSnapshotArtifactId);
      const auditArtifact = googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.auditArtifactId);
      const sourceArtifact = googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.sourceArtifactId);
      const folderPath = 'delivery-workspace/juridisk';

      addTextFile(
        `${agreementKey}-legal-readme`,
        `${safeName}-juridisk.txt`,
        [
          `Avtale: ${agreement.title}`,
          `Motpart: ${agreement.counterparty_name}`,
          `Status: ${agreement.status}`,
          `Signaturstatus: ${agreement.google_signature?.status ?? 'not_started'}`,
          `Signert: ${agreement.signed_date || agreement.google_signature?.signedAt || 'Ikke signert'}`,
          `Dokumentlenke: ${signedPdfArtifact?.webViewUrl || pdfSnapshotArtifact?.webViewUrl || agreement.google_signature?.requestUrl || agreement.google_signature?.webViewUrl || 'Ikke satt'}`,
          `Signaturspor: ${auditArtifact?.webViewUrl || 'Ikke satt'}`,
          `Google-kilde: ${sourceArtifact?.webViewUrl || 'Ikke satt'}`,
        ].join('\n'),
        {
          source: 'role_room_delivery_workspace',
          workspaceType: 'legal_agreement_readme',
          agreementId: agreement.id,
          deliveryTitle: agreement.title,
          folderPath,
          packageName,
          versionLabel: agreement.google_signature?.signedAt ? 'signed' : 'draft',
          deliveryStageLabel: 'Juridisk dokument',
          generatedAt: generatedAtIso,
        },
      );

      addJsonFile(
        `${agreementKey}-legal-json`,
        `${safeName}.legal.json`,
        {
          agreement,
          artifacts: {
            sourceArtifact,
            pdfSnapshotArtifact,
            signedPdfArtifact,
            auditArtifact,
          },
        },
        {
          source: 'role_room_delivery_workspace',
          workspaceType: 'legal_agreement_manifest_item',
          agreementId: agreement.id,
          deliveryTitle: agreement.title,
          folderPath,
          packageName,
          versionLabel: agreement.google_signature?.signedAt ? 'signed' : 'draft',
          deliveryStageLabel: 'Juridisk dokument',
          generatedAt: generatedAtIso,
        },
      );
    });

    return {
      packageName,
      files,
      generatedAtIso,
    };
  }
}

export const producerDeliveryWorkspaceService = new ProducerDeliveryWorkspaceService();
