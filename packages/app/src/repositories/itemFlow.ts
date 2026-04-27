import type {
  CandidateInfo,
  GarmentItem,
  GarmentItemInput,
  MeasurementInput,
  SaleInfo,
} from '@seam/shared';
import { isCandidateStatus } from '@seam/shared';
import type { SavedPhoto } from '../photos/savePhoto';
import { deletePhotoFiles } from '../photos/savePhoto';
import { candidateInfoRepository } from './candidateInfoRepository';
import { evaluationRepository } from './evaluationRepository';
import { failureLogRepository } from './failureLogRepository';
import { fitAnchorRepository } from './fitAnchorRepository';
import { itemRepository } from './itemRepository';
import { measurementRepository } from './measurementRepository';
import { photoRepository } from './photoRepository';
import { priceSnapshotRepository } from './priceSnapshotRepository';
import { saleInfoRepository } from './saleInfoRepository';
import { tagRepository } from './tagRepository';
import { wearLogRepository } from './wearLogRepository';

export type CreateItemDetailsInput = {
  item: GarmentItemInput;
  measurements: MeasurementInput[];
  photos: SavedPhoto[];
  tags: readonly string[];
  fitAnchorName?: string;
  fitAnchorNotes?: string;
  candidateInfo?: Omit<CandidateInfo, 'itemId'>;
};

export const createItemWithDetails = async (
  input: CreateItemDetailsInput,
): Promise<GarmentItem> => {
  const created = await itemRepository.create(input.item);

  if (input.measurements.length > 0) {
    const withItemId = input.measurements.map((m) => ({ ...m, itemId: created.id }));
    await measurementRepository.upsertForItem(created.id, withItemId);
  }

  for (let i = 0; i < input.photos.length; i += 1) {
    const p = input.photos[i];
    if (!p) continue;

    await photoRepository.create(created.id, p.relativePath, p.thumbnailRelativePath, i);
  }

  if (input.tags.length > 0) {
    await tagRepository.setForItem(created.id, input.tags);
  }

  if (input.item.isFitAnchor && input.fitAnchorName && input.fitAnchorName.trim() !== '') {
    await fitAnchorRepository.create({
      itemId: created.id,
      name: input.fitAnchorName.trim(),
      category: created.category,
      notes: input.fitAnchorNotes?.trim() || undefined,
    });
  }

  if (input.candidateInfo && isCandidateStatus(created.status)) {
    await candidateInfoRepository.upsert({ ...input.candidateInfo, itemId: created.id });
  }

  return created;
};

export type UpdateItemDetailsInput = {
  id: string;
  patch: Partial<Omit<GarmentItem, 'id' | 'createdAt'>>;
  measurements?: MeasurementInput[];
  /** if provided, fully replaces the existing tag set */
  tags?: readonly string[];
  /** if provided, replaces the fit anchor (or removes when isFitAnchor=false in patch) */
  fitAnchorName?: string;
  fitAnchorNotes?: string;
  /** if provided and the resulting status is a candidate, upserts CandidateInfo */
  candidateInfo?: Omit<CandidateInfo, 'itemId'>;
};

export const updateItemWithDetails = async (input: UpdateItemDetailsInput): Promise<void> => {
  await itemRepository.update(input.id, input.patch);

  if (input.measurements) {
    const withItemId = input.measurements.map((m) => ({ ...m, itemId: input.id }));
    await measurementRepository.upsertForItem(input.id, withItemId);
  }

  if (input.tags) {
    await tagRepository.setForItem(input.id, input.tags);
  }

  if (input.patch.isFitAnchor === true) {
    await fitAnchorRepository.deleteByItemId(input.id);
    const item = await itemRepository.getById(input.id);
    if (item) {
      const name = input.fitAnchorName?.trim() || item.name;
      await fitAnchorRepository.create({
        itemId: input.id,
        name,
        category: item.category,
        notes: input.fitAnchorNotes?.trim() || undefined,
      });
    }
  } else if (input.patch.isFitAnchor === false) {
    await fitAnchorRepository.deleteByItemId(input.id);
  }

  // Sync CandidateInfo with status. We refetch to know the *current* status
  // (the patch may not include it).
  const current = await itemRepository.getById(input.id);
  if (current) {
    if (isCandidateStatus(current.status)) {
      if (input.candidateInfo) {
        await candidateInfoRepository.upsert({ ...input.candidateInfo, itemId: input.id });
      }
    } else {
      // Once status leaves the candidate space, drop the candidate metadata.
      await candidateInfoRepository.deleteByItemId(input.id);
    }
  }
};

export const deleteItemWithDetails = async (id: string): Promise<void> => {
  const photos = await photoRepository.listByItem(id);
  // DB-level ON DELETE CASCADE should cover dependents but be explicit so
  // any future change in cascade rules can't silently leak rows.
  await priceSnapshotRepository.deleteByItem(id);
  await evaluationRepository.deleteByItem(id);
  await candidateInfoRepository.deleteByItemId(id);
  await wearLogRepository.deleteByItem(id);
  await failureLogRepository.deleteByItem(id);
  await saleInfoRepository.deleteByItemId(id);
  await itemRepository.delete(id);
  for (const p of photos) {
    try {
      await deletePhotoFiles(p.relativePath, p.thumbnailRelativePath);
    } catch {
      // ignore
    }
  }
};

/**
 * Mark an owned item as sold:
 *   1. Persist the SaleInfo row (price / date / source / notes).
 *   2. Move the item to status='sold'.
 *
 * Caller is responsible for ensuring the current status is 'owned'
 * (canTransitionStatus enforces owned → sold).
 */
export const markAsSold = async (
  itemId: string,
  saleInfo: Omit<SaleInfo, 'itemId'>,
): Promise<void> => {
  await saleInfoRepository.upsert({ ...saleInfo, itemId });
  await itemRepository.setStatus(itemId, 'sold');
};

/**
 * Reverse {@link markAsSold}: drop the SaleInfo row and bring the item back
 * to 'owned'. Useful as an undo, or when the user logged a sale by mistake.
 *
 * Note: ITEM_STATUSES allowed-transitions table currently disallows sold→owned.
 * We bypass that here intentionally because this is a manual undo, not a
 * forward state transition.
 */
export const unmarkAsSold = async (itemId: string): Promise<void> => {
  await saleInfoRepository.deleteByItemId(itemId);
  await itemRepository.setStatus(itemId, 'owned');
};
