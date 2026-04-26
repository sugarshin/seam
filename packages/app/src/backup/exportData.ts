import * as FileSystem from 'expo-file-system/legacy';
import { db, schema } from '../db/client';
import { nowIso } from '../utils/dates';

const SCHEMA_VERSION = 1;

export type ExportPayload = {
  meta: {
    schemaVersion: number;
    exportedAt: string;
    appVersion: string;
  };
  tables: {
    items: unknown[];
    measurements: unknown[];
    photos: unknown[];
    fitAnchors: unknown[];
    candidateInfos: unknown[];
    candidateEvaluations: unknown[];
    decisionLogs: unknown[];
    failureLogs: unknown[];
    measurementRules: unknown[];
    brandGuides: unknown[];
    brandChecklistStates: unknown[];
    wearLogs: unknown[];
    saleInfos: unknown[];
    priceSnapshots: unknown[];
    tags: unknown[];
    itemTags: unknown[];
    reminders: unknown[];
  };
};

export const buildExportPayload = async (appVersion: string): Promise<ExportPayload> => {
  const [
    items,
    measurements,
    photos,
    fitAnchors,
    candidateInfos,
    candidateEvaluations,
    decisionLogs,
    failureLogs,
    measurementRules,
    brandGuides,
    brandChecklistStates,
    wearLogs,
    saleInfos,
    priceSnapshots,
    tags,
    itemTags,
    reminders,
  ] = await Promise.all([
    db.select().from(schema.items),
    db.select().from(schema.measurements),
    db.select().from(schema.photos),
    db.select().from(schema.fitAnchors),
    db.select().from(schema.candidateInfos),
    db.select().from(schema.candidateEvaluations),
    db.select().from(schema.decisionLogs),
    db.select().from(schema.failureLogs),
    db.select().from(schema.measurementRules),
    db.select().from(schema.brandGuides),
    db.select().from(schema.brandChecklistStates),
    db.select().from(schema.wearLogs),
    db.select().from(schema.saleInfos),
    db.select().from(schema.priceSnapshots),
    db.select().from(schema.tags),
    db.select().from(schema.itemTags),
    db.select().from(schema.reminders),
  ]);

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      appVersion,
    },
    tables: {
      items,
      measurements,
      photos,
      fitAnchors,
      candidateInfos,
      candidateEvaluations,
      decisionLogs,
      failureLogs,
      measurementRules,
      brandGuides,
      brandChecklistStates,
      wearLogs,
      saleInfos,
      priceSnapshots,
      tags,
      itemTags,
      reminders,
    },
  };
};

export const writeExportFile = async (payload: ExportPayload): Promise<string> => {
  const baseDir = `${FileSystem.documentDirectory ?? ''}exports/`;
  const dirInfo = await FileSystem.getInfoAsync(baseDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  }
  const stamp = payload.meta.exportedAt.replace(/[:.]/g, '-');
  const path = `${baseDir}seam-${stamp}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
  return path;
};

export const exportToFile = async (appVersion: string): Promise<string> => {
  const payload = await buildExportPayload(appVersion);
  return writeExportFile(payload);
};
