import JSZip from 'jszip';
import type {
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerProjectPlanning,
} from '../models/casting';
import type { ContentProductionEstimate } from './contentProductionEstimateService';
import type { ProducerDeliveryManifest } from '../utils/producerProjectPlanning';

export interface ProducerDeliveryPackagePayload {
  projectId: string;
  projectName: string;
  planning: ProducerProjectPlanning;
  manifest: ProducerDeliveryManifest;
  estimate: ContentProductionEstimate;
  clientIntake: ProducerClientIntake;
  clientMaterials: ProducerClientMaterial[];
  clientPortalUrl: string;
  clientInputSummaryText: string;
  manifestText: string;
  contributionTasksText: string;
  generatedAt?: Date;
}

export interface ProducerDeliveryPackageBuildResult {
  file: File;
  packageName: string;
  rootFolder: string;
  folderPath: string;
  versionLabel: string;
  generatedAtIso: string;
}

const sanitizeSegment = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'leveranse'
);

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const readFirstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const getPrimaryVersionLabel = (manifest: ProducerDeliveryManifest): string => (
  manifest.deliveryItems[0]?.versionLabel
  || 'v01'
);

const getPackageName = (projectName: string, generatedAt: Date): string => {
  const datePart = generatedAt.toISOString().slice(0, 10);
  return `${sanitizeSegment(projectName)}-klientpakke-${datePart}`;
};

const normalizeFolderPath = (value: string): string => (
  value
    .split('/')
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0)
    .join('/')
);

const toJson = (value: unknown): string => JSON.stringify(value, null, 2);

const buildMaterialReferencePayload = (materials: ProducerClientMaterial[]) => (
  materials.map((material) => {
    const metadata = asRecord(material.metadata);
    return {
      id: material.id,
      title: material.title,
      type: material.entry_type,
      status: material.status ?? 'provided',
      phase: material.phase ?? null,
      linkedShotListId: material.linked_shot_list_id ?? null,
      externalUrl: material.external_url ?? null,
      metadata: {
        fileName: readFirstNonEmptyString(metadata.fileName, metadata.filename),
        versionLabel: readFirstNonEmptyString(metadata.versionLabel, metadata.version),
        usageNotes: readFirstNonEmptyString(metadata.usageNotes, metadata.usage),
        sourceLabel: readFirstNonEmptyString(metadata.sourceLabel, metadata.source),
        folderPath: readFirstNonEmptyString(metadata.folderPath),
        packageName: readFirstNonEmptyString(metadata.packageName),
        projectFileId: readFirstNonEmptyString(metadata.projectFileId),
        projectFileDownloadUrl: readFirstNonEmptyString(metadata.projectFileDownloadUrl),
      },
      updatedAt: material.updated_at ?? material.created_at ?? null,
    };
  })
);

class ProducerDeliveryPackageService {
  async buildClientPackage(payload: ProducerDeliveryPackagePayload): Promise<ProducerDeliveryPackageBuildResult> {
    const generatedAt = payload.generatedAt ?? new Date();
    const generatedAtIso = generatedAt.toISOString();
    const packageName = getPackageName(payload.projectName, generatedAt);
    const versionLabel = getPrimaryVersionLabel(payload.manifest);
    const rootFolder = `${packageName}`;
    const folderPath = `client-handoff/${packageName}`;
    const zip = new JSZip();

    const addTextFile = (relativePath: string, content: string) => {
      zip.file(`${rootFolder}/${relativePath}`, content);
    };

    addTextFile('00-oversikt/overleveringsbrief.txt', payload.clientInputSummaryText);
    addTextFile('00-oversikt/leveringsmanifest.txt', payload.manifestText);
    addTextFile('00-oversikt/klientoppgaver.txt', payload.contributionTasksText);
    addTextFile('00-oversikt/client-portal-url.txt', payload.clientPortalUrl);
    addTextFile('00-oversikt/kontotilgang.json', toJson(payload.manifest.accountAccessSummary));
    addTextFile('00-oversikt/kontotilgang.txt', [
      `Nødvendige plattformer koblet: ${payload.manifest.accountAccessSummary.connectedCount}/${payload.manifest.accountAccessSummary.requiredPlatformCount}`,
      `Trenger klienthandling: ${payload.manifest.accountAccessSummary.clientActionCount}`,
      `Invitasjoner sendt: ${payload.manifest.accountAccessSummary.inviteSentCount}`,
      `Sikkerhetsnotat: ${payload.manifest.accountAccessSummary.securityNotes || 'Ikke satt'}`,
      `Revoke-plan: ${payload.manifest.accountAccessSummary.revokePlan || 'Ikke satt'}`,
      '',
      ...(payload.manifest.accountAccessSummary.entries.length > 0
        ? payload.manifest.accountAccessSummary.entries.flatMap((entry) => ([
          `${entry.platformLabel}${entry.requiredForProject ? ' · kreves' : ''}`,
          `  Status: ${entry.statusLabel} · Metode: ${entry.methodLabel}`,
          `  Scope: ${entry.accessScope || 'Ikke satt'}`,
          `  Konto / side: ${entry.accountLabel || 'Ikke satt'}`,
          `  Invite: ${entry.inviteTarget || 'Ikke satt'}`,
          `  Eier: ${entry.clientOwnerLabel || 'Ikke satt'}`,
          `  2-faktor hos kontoeier: ${entry.twoFactorRequired ? 'Ja' : 'Nei'}`,
          `  Notat: ${entry.notes || 'Ingen notater.'}`,
          '',
        ]))
        : ['Ingen kontotilganger registrert.', '']),
    ].join('\n'));

    addTextFile('01-strategi/strategi.json', toJson({
      direction: payload.manifest.direction,
      idea: payload.manifest.idea,
      activation: payload.manifest.activation,
      businessGoal: payload.manifest.businessGoal,
      targetAudience: payload.manifest.targetAudience,
      primaryDeliveryLabel: payload.manifest.primaryDeliveryLabel,
      recommendedShootDays: payload.manifest.recommendedShootDays,
      generatedAt: generatedAtIso,
    }));

    addTextFile('02-merkevareguide/merkevareguide.json', toJson(payload.planning.brandGuide));
    addTextFile('02-merkevareguide/logo-usage-matrix.json', toJson(payload.manifest.logoUsageMatrix));
    addTextFile('03-leveringsrutine/leveringsrutine.json', toJson(payload.planning.deliveryWorkflow));
    addTextFile('04-klientgrunnlag/brief.json', toJson(payload.clientIntake));
    addTextFile('04-klientgrunnlag/materialer.json', toJson(buildMaterialReferencePayload(payload.clientMaterials)));
    addTextFile('04-klientgrunnlag/produksjonsestimat.json', toJson(payload.estimate));
    addTextFile('05-framework/rammeverk.json', toJson(payload.manifest.frameworkSections));

    payload.manifest.deliveryItems.forEach((item, index) => {
      const safeFolderPath = normalizeFolderPath(item.folderPath);
      const baseFolder = safeFolderPath.length > 0
        ? `06-leveranser/${safeFolderPath}`
        : '06-leveranser/ukategorisert';

      addTextFile(`${baseFolder}/README-${String(index + 1).padStart(2, '0')}.txt`, [
        `Leveranse: ${item.title}`,
        `Format: ${item.format}`,
        `Kanal: ${item.channel}`,
        `Filnavn: ${item.filename}`,
        `Pakke: ${item.packageName}`,
        `Versjon: ${item.versionLabel}`,
        `Leveringstrinn: ${item.deliveryStageLabel}`,
        `Publisering: ${item.publishDateLabel}`,
        `Estimert lengde: ${item.estimatedDurationLabel}`,
        `Notat: ${item.notes || 'Ingen notater.'}`,
      ].join('\n'));

      addTextFile(`${baseFolder}/delivery-item-${String(index + 1).padStart(2, '0')}.json`, toJson(item));
    });

    addTextFile('manifest.json', toJson({
      projectId: payload.projectId,
      projectName: payload.projectName,
      packageName,
      folderPath,
      versionLabel,
      generatedAt: generatedAtIso,
      clientPortalUrl: payload.clientPortalUrl,
      deliveryItems: payload.manifest.deliveryItems,
      logoUsageMatrix: payload.manifest.logoUsageMatrix,
      accountAccessSummary: payload.manifest.accountAccessSummary,
    }));

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const file = new File([blob], `${packageName}.zip`, {
      type: 'application/zip',
      lastModified: generatedAt.getTime(),
    });

    return {
      file,
      packageName,
      rootFolder,
      folderPath,
      versionLabel,
      generatedAtIso,
    };
  }
}

export const producerDeliveryPackageService = new ProducerDeliveryPackageService();
