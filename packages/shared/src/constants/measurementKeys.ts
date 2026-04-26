import type { GarmentCategory, MeasurementCategoryGroup } from './categories';
import { measurementGroupOf } from './categories';

export const TOP_MEASUREMENT_KEYS = [
  'shoulderWidth',
  'chestWidth',
  'bodyLength',
  'sleeveLength',
  'neckToSleeve',
] as const;

export const PANTS_MEASUREMENT_KEYS = [
  'waist',
  'rise',
  'inseam',
  'thighWidth',
  'kneeWidth',
  'hemWidth',
  'totalLength',
] as const;

export const SHOES_MEASUREMENT_KEYS = [
  'jpSize',
  'usSize',
  'ukSize',
  'euSize',
  'outsoleLength',
  'outsoleWidth',
] as const;

export const ALL_MEASUREMENT_KEYS = [
  ...TOP_MEASUREMENT_KEYS,
  ...PANTS_MEASUREMENT_KEYS,
  ...SHOES_MEASUREMENT_KEYS,
] as const;

export type TopMeasurementKey = (typeof TOP_MEASUREMENT_KEYS)[number];
export type PantsMeasurementKey = (typeof PANTS_MEASUREMENT_KEYS)[number];
export type ShoesMeasurementKey = (typeof SHOES_MEASUREMENT_KEYS)[number];
export type MeasurementKey = (typeof ALL_MEASUREMENT_KEYS)[number];

export const MEASUREMENT_UNITS = ['cm', 'inch', 'jp', 'us', 'uk', 'eu'] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const MEASUREMENT_KEY_LABEL: Record<MeasurementKey, string> = {
  shoulderWidth: '肩幅',
  chestWidth: '身幅',
  bodyLength: '着丈',
  sleeveLength: '袖丈',
  neckToSleeve: '裄丈',
  waist: 'ウエスト',
  rise: '股上',
  inseam: '股下',
  thighWidth: 'ワタリ',
  kneeWidth: '膝幅',
  hemWidth: '裾幅',
  totalLength: '総丈',
  jpSize: 'JPサイズ',
  usSize: 'USサイズ',
  ukSize: 'UKサイズ',
  euSize: 'EUサイズ',
  outsoleLength: 'アウトソール長',
  outsoleWidth: 'アウトソール幅',
};

export const measurementKeysFor = (category: GarmentCategory): readonly MeasurementKey[] => {
  const group: MeasurementCategoryGroup = measurementGroupOf(category);
  switch (group) {
    case 'top':
      return TOP_MEASUREMENT_KEYS;
    case 'pants':
      return PANTS_MEASUREMENT_KEYS;
    case 'shoes':
      return SHOES_MEASUREMENT_KEYS;
    case 'none':
      return [];
  }
};

export const defaultUnitFor = (key: MeasurementKey): MeasurementUnit => {
  switch (key) {
    case 'jpSize':
      return 'jp';
    case 'usSize':
      return 'us';
    case 'ukSize':
      return 'uk';
    case 'euSize':
      return 'eu';
    default:
      return 'cm';
  }
};
