import { asc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { BrandGuide, GarmentCategory } from '@seam/shared';

type Row = typeof schema.brandGuides.$inferSelect;

const parseChecklist = (raw: string): string[] => {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) if (typeof x === 'string') out.push(x);
    return out;
  } catch {
    return [];
  }
};

const toGuide = (row: Row): BrandGuide => ({
  id: row.id,
  brand: row.brand,
  category: row.category === null ? undefined : (row.category as GarmentCategory),
  title: row.title,
  notes: row.notes,
  checklistItems: parseChecklist(row.checklistItems),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const brandGuideRepository = {
  async listAll(): Promise<BrandGuide[]> {
    const rows = await db
      .select()
      .from(schema.brandGuides)
      .orderBy(asc(schema.brandGuides.brand), asc(schema.brandGuides.title));
    return rows.map(toGuide);
  },

  async listByBrand(brand: string): Promise<BrandGuide[]> {
    const rows = await db
      .select()
      .from(schema.brandGuides)
      .where(eq(schema.brandGuides.brand, brand))
      .orderBy(asc(schema.brandGuides.title));
    return rows.map(toGuide);
  },

  async getById(id: string): Promise<BrandGuide | null> {
    const rows = await db
      .select()
      .from(schema.brandGuides)
      .where(eq(schema.brandGuides.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toGuide(row) : null;
  },

  async create(input: Omit<BrandGuide, 'id' | 'createdAt' | 'updatedAt'>): Promise<BrandGuide> {
    const id = newId();
    const ts = nowIso();
    const row: Row = {
      id,
      brand: input.brand,
      category: input.category ?? null,
      title: input.title,
      notes: input.notes,
      checklistItems: JSON.stringify(input.checklistItems ?? []),
      createdAt: ts,
      updatedAt: ts,
    };
    await db.insert(schema.brandGuides).values(row);
    return toGuide(row);
  },

  async update(
    id: string,
    patch: Partial<Omit<BrandGuide, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const update: Partial<Row> = {};
    if (patch.brand !== undefined) update.brand = patch.brand;
    if (patch.category !== undefined) update.category = patch.category ?? null;
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.checklistItems !== undefined)
      update.checklistItems = JSON.stringify(patch.checklistItems);
    update.updatedAt = nowIso();
    await db.update(schema.brandGuides).set(update).where(eq(schema.brandGuides.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.brandGuides).where(eq(schema.brandGuides.id, id));
  },
};
