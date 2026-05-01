import { useMemo, useState } from 'react';
import { ScrollView, Switch, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CATEGORY_LABEL,
  CONDITION_RANKS,
  CONDITION_RANK_DESCRIPTION,
  CONDITION_RANK_LABEL,
  GARMENT_CATEGORIES,
  ITEM_STATUSES,
  ITEM_STATUS_LABEL,
  SOURCE_TYPES,
  SOURCE_TYPE_LABEL,
  type CandidateInfo,
  type ConditionRank,
  type GarmentCategory,
  type GarmentItemInput,
  type ItemStatus,
  type MeasurementInput,
  type SourceType,
} from '@seam/shared';
import { calculateTotalPrice } from '@seam/domain/pricing';
import { Button } from '../components/Button';
import { MeasurementInputGroup } from '../components/MeasurementInputGroup';
import { PhotoPicker } from '../components/PhotoPicker';
import { Picker, type PickerOption } from '../components/Picker';
import { TagInput } from '../components/TagInput';
import { TextField } from '../components/TextField';
import type { SavedPhoto } from '../photos/savePhoto';
import { colors, font, radii, space } from '../theme';

const FAVORITE_SCORE_VALUES = [1, 2, 3, 4, 5] as const;
type FavoriteScore = (typeof FAVORITE_SCORE_VALUES)[number];
const isFavoriteScore = (n: number): n is FavoriteScore =>
  (FAVORITE_SCORE_VALUES as readonly number[]).includes(n);

// Status options exposed to the picker — `sold` is reserved for Phase 6
// (post-purchase flow), so we omit it from the form input.
const SELECTABLE_STATUSES = ITEM_STATUSES.filter((s) => s !== 'sold') as readonly Exclude<
  ItemStatus,
  'sold'
>[];
const CANDIDATE_STATUS_SET = new Set<ItemStatus>([
  'wishlist',
  'watching',
  'bidding',
  'negotiating',
]);

const FormSchema = z.object({
  name: z.string().trim().min(1, '必須です'),
  brand: z.string().trim().optional(),
  modelName: z.string().trim().optional(),
  category: z.enum(GARMENT_CATEGORIES),
  status: z.enum(ITEM_STATUSES),
  color: z.string().trim().optional(),
  sizeLabel: z.string().trim().optional(),
  conditionRank: z.enum(CONDITION_RANKS as readonly [ConditionRank, ...ConditionRank[]]).optional(),
  conditionNotes: z.string().trim().optional(),
  fitRating: z.enum(['too_small', 'just', 'slightly_large', 'large', 'too_large']).optional(),
  favoriteScore: z.number().int().min(1).max(5).optional(),
  purchasePrice: z.string().trim().optional(),
  shippingFee: z.string().trim().optional(),
  purchaseDate: z.string().trim().optional(),
  purchaseSource: z.string().trim().optional(),
  productUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => v === undefined || v === '' || /^https?:\/\//i.test(v),
      'http(s):// で始まる URL',
    ),
  notes: z.string().trim().optional(),
  isFitAnchor: z.boolean(),
  fitAnchorName: z.string().trim().optional(),
  fitAnchorNotes: z.string().trim().optional(),

  // Candidate-only fields. Validated softly because the section is hidden
  // unless the status is candidate.
  sourceType: z.enum(SOURCE_TYPES).optional(),
  candidateCurrentPrice: z.string().trim().optional(),
  candidateShippingFee: z.string().trim().optional(),
  auctionEndsAt: z.string().trim().optional(),
  easyBuyPrice: z.string().trim().optional(),
  acceptablePrice: z.string().trim().optional(),
  maxBidPrice: z.string().trim().optional(),
  sellerName: z.string().trim().optional(),
  listingDescription: z.string().trim().optional(),
});

export type ItemFormValues = z.infer<typeof FormSchema>;

export type ItemFormSubmit = {
  item: GarmentItemInput;
  measurements: MeasurementInput[];
  photos: SavedPhoto[];
  tags: string[];
  fitAnchorName?: string;
  fitAnchorNotes?: string;
  candidateInfo?: Omit<CandidateInfo, 'itemId'>;
};

export type ItemFormDefaults = {
  values?: Partial<ItemFormValues>;
  measurements?: MeasurementInput[];
  photos?: SavedPhoto[];
  tags?: string[];
};

type Props = {
  defaults?: ItemFormDefaults;
  itemId?: string;
  tagSuggestions?: readonly string[];
  submitLabel?: string;
  onSubmit: (input: ItemFormSubmit) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
};

const PLACEHOLDER_ITEM_ID = 'pending';

const STATUS_OPTIONS: readonly PickerOption<ItemStatus>[] = SELECTABLE_STATUSES.map((s) => ({
  value: s,
  label: ITEM_STATUS_LABEL[s],
}));

const CATEGORY_OPTIONS: readonly PickerOption<GarmentCategory>[] = GARMENT_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABEL[c],
}));

const CONDITION_OPTIONS: readonly PickerOption<ConditionRank>[] = CONDITION_RANKS.map((r) => ({
  value: r,
  label: `${r} — ${CONDITION_RANK_LABEL[r]}`,
  description: CONDITION_RANK_DESCRIPTION[r],
}));

const FIT_RATING_OPTIONS: readonly PickerOption<NonNullable<ItemFormValues['fitRating']>>[] = [
  { value: 'too_small', label: '小さすぎ' },
  { value: 'just', label: 'ジャスト' },
  { value: 'slightly_large', label: '少し大きい' },
  { value: 'large', label: '大きめ' },
  { value: 'too_large', label: '大きすぎ' },
];

const FAVORITE_SCORE_OPTIONS: readonly PickerOption<string>[] = FAVORITE_SCORE_VALUES.map((n) => ({
  value: String(n),
  label: '★'.repeat(n),
}));

const SOURCE_TYPE_OPTIONS: readonly PickerOption<SourceType>[] = SOURCE_TYPES.map((s) => ({
  value: s,
  label: SOURCE_TYPE_LABEL[s],
}));

const parseIntOrUndef = (s: string | undefined): number | undefined => {
  if (s === undefined || s.trim() === '') return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
};

export const ItemForm = ({
  defaults,
  itemId,
  tagSuggestions,
  submitLabel = '保存',
  onSubmit,
  onCancel,
  submitting = false,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [measurements, setMeasurements] = useState<MeasurementInput[]>(
    defaults?.measurements ?? [],
  );
  const [photos, setPhotos] = useState<SavedPhoto[]>(defaults?.photos ?? []);
  const [tags, setTags] = useState<string[]>(defaults?.tags ?? []);

  const initialValues = useMemo<ItemFormValues>(
    () => ({
      name: defaults?.values?.name ?? '',
      brand: defaults?.values?.brand ?? '',
      modelName: defaults?.values?.modelName ?? '',
      category: defaults?.values?.category ?? 't_shirt',
      status: defaults?.values?.status ?? 'owned',
      color: defaults?.values?.color ?? '',
      sizeLabel: defaults?.values?.sizeLabel ?? '',
      conditionRank: defaults?.values?.conditionRank,
      conditionNotes: defaults?.values?.conditionNotes ?? '',
      fitRating: defaults?.values?.fitRating,
      favoriteScore: defaults?.values?.favoriteScore,
      purchasePrice: defaults?.values?.purchasePrice ?? '',
      shippingFee: defaults?.values?.shippingFee ?? '',
      purchaseDate: defaults?.values?.purchaseDate ?? '',
      purchaseSource: defaults?.values?.purchaseSource ?? '',
      productUrl: defaults?.values?.productUrl ?? '',
      notes: defaults?.values?.notes ?? '',
      isFitAnchor: defaults?.values?.isFitAnchor ?? false,
      fitAnchorName: defaults?.values?.fitAnchorName ?? '',
      fitAnchorNotes: defaults?.values?.fitAnchorNotes ?? '',
      sourceType: defaults?.values?.sourceType,
      candidateCurrentPrice: defaults?.values?.candidateCurrentPrice ?? '',
      candidateShippingFee: defaults?.values?.candidateShippingFee ?? '',
      auctionEndsAt: defaults?.values?.auctionEndsAt ?? '',
      easyBuyPrice: defaults?.values?.easyBuyPrice ?? '',
      acceptablePrice: defaults?.values?.acceptablePrice ?? '',
      maxBidPrice: defaults?.values?.maxBidPrice ?? '',
      sellerName: defaults?.values?.sellerName ?? '',
      listingDescription: defaults?.values?.listingDescription ?? '',
    }),
    [defaults],
  );

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  const watchedCategory = watch('category');
  const watchedIsFitAnchor = watch('isFitAnchor');
  const watchedStatus = watch('status');
  const watchedCandidatePrice = watch('candidateCurrentPrice');
  const watchedCandidateShipping = watch('candidateShippingFee');
  const isCandidate = CANDIDATE_STATUS_SET.has(watchedStatus);
  const isOwned = watchedStatus === 'owned';

  const candidateTotalPreview = useMemo(() => {
    const p = parseIntOrUndef(watchedCandidatePrice);
    const s = parseIntOrUndef(watchedCandidateShipping);
    if (p === undefined && s === undefined) return undefined;
    return calculateTotalPrice(p, s);
  }, [watchedCandidatePrice, watchedCandidateShipping]);

  const measurementItemId = itemId ?? PLACEHOLDER_ITEM_ID;

  const submit = handleSubmit(async (values) => {
    const favoriteScore =
      values.favoriteScore !== undefined && isFavoriteScore(values.favoriteScore)
        ? values.favoriteScore
        : undefined;

    const purchasePrice = parseIntOrUndef(values.purchasePrice);
    const shippingFee = parseIntOrUndef(values.shippingFee);
    const totalPrice =
      purchasePrice !== undefined || shippingFee !== undefined
        ? calculateTotalPrice(purchasePrice, shippingFee)
        : undefined;

    const empty = (s: string | undefined): string | undefined =>
      s !== undefined && s.trim() !== '' ? s.trim() : undefined;

    const item: GarmentItemInput = {
      status: values.status,
      name: values.name.trim(),
      brand: empty(values.brand),
      modelName: empty(values.modelName),
      category: values.category,
      color: empty(values.color),
      sizeLabel: empty(values.sizeLabel),
      purchasePrice,
      shippingFee,
      totalPrice,
      purchaseDate: empty(values.purchaseDate),
      purchaseSource: empty(values.purchaseSource),
      productUrl: empty(values.productUrl),
      conditionRank: values.conditionRank,
      conditionNotes: empty(values.conditionNotes),
      fitRating: values.fitRating,
      favoriteScore,
      isFitAnchor: values.isFitAnchor,
      isSellCandidate: false,
      notes: empty(values.notes),
    };

    let candidateInfo: Omit<CandidateInfo, 'itemId'> | undefined;
    if (CANDIDATE_STATUS_SET.has(values.status) && values.sourceType) {
      const candCurrent = parseIntOrUndef(values.candidateCurrentPrice);
      const candShipping = parseIntOrUndef(values.candidateShippingFee);
      const candTotal =
        candCurrent !== undefined || candShipping !== undefined
          ? calculateTotalPrice(candCurrent, candShipping)
          : undefined;
      candidateInfo = {
        sourceType: values.sourceType,
        currentPrice: candCurrent,
        shippingFee: candShipping,
        totalPrice: candTotal,
        auctionEndsAt: empty(values.auctionEndsAt),
        easyBuyPrice: parseIntOrUndef(values.easyBuyPrice),
        acceptablePrice: parseIntOrUndef(values.acceptablePrice),
        maxBidPrice: parseIntOrUndef(values.maxBidPrice),
        sellerName: empty(values.sellerName),
        listingDescription: empty(values.listingDescription),
      };
    }

    await onSubmit({
      item,
      measurements: measurements.map((m) => ({ ...m, itemId: measurementItemId })),
      photos,
      tags,
      fitAnchorName: empty(values.fitAnchorName),
      fitAnchorNotes: empty(values.fitAnchorNotes),
      candidateInfo,
    });
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: space.lg,
        paddingBottom: space.xxl + insets.bottom,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle>基本</SectionTitle>

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="名前"
            required
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.name?.message}
            placeholder="例: Champion Reverse Weave"
          />
        )}
      />

      <Controller
        control={control}
        name="brand"
        render={({ field }) => (
          <TextField
            label="ブランド"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Controller
        control={control}
        name="modelName"
        render={({ field }) => (
          <TextField
            label="モデル名"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <Picker<GarmentCategory>
            label="カテゴリ"
            required
            value={field.value}
            options={CATEGORY_OPTIONS}
            onChange={field.onChange}
            modalTitle="カテゴリを選択"
            error={errors.category?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <Picker<ItemStatus>
            label="ステータス"
            required
            value={field.value}
            options={STATUS_OPTIONS}
            onChange={field.onChange}
            modalTitle="ステータスを選択"
          />
        )}
      />

      <View style={twoColumn}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <TextField
                label="色"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="sizeLabel"
            render={({ field }) => (
              <TextField
                label="サイズ表記"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="L / 32"
              />
            )}
          />
        </View>
      </View>

      <SectionTitle>写真</SectionTitle>
      <PhotoPicker photos={photos} onChange={setPhotos} />

      <SectionTitle>実寸</SectionTitle>
      <MeasurementInputGroup
        category={watchedCategory}
        itemId={measurementItemId}
        values={measurements}
        onChange={setMeasurements}
      />

      <SectionTitle>状態 / 評価</SectionTitle>

      <Controller
        control={control}
        name="conditionRank"
        render={({ field }) => (
          <Picker<ConditionRank>
            label="コンディション"
            value={field.value}
            options={CONDITION_OPTIONS}
            onChange={field.onChange}
            modalTitle="コンディション"
          />
        )}
      />

      <Controller
        control={control}
        name="conditionNotes"
        render={({ field }) => (
          <TextField
            label="ダメージメモ"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            multiline
          />
        )}
      />

      <Controller
        control={control}
        name="fitRating"
        render={({ field }) => (
          <Picker
            label="フィット"
            value={field.value}
            options={FIT_RATING_OPTIONS}
            onChange={field.onChange}
            modalTitle="フィット感"
          />
        )}
      />

      <Controller
        control={control}
        name="favoriteScore"
        render={({ field }) => (
          <Picker<string>
            label="お気に入り度"
            value={field.value !== undefined ? String(field.value) : undefined}
            options={FAVORITE_SCORE_OPTIONS}
            onChange={(v) => field.onChange(Number(v))}
            modalTitle="お気に入り度"
          />
        )}
      />

      {isCandidate && (
        <>
          <SectionTitle>販売情報</SectionTitle>

          <Controller
            control={control}
            name="sourceType"
            render={({ field }) => (
              <Picker<SourceType>
                label="出品元"
                value={field.value}
                options={SOURCE_TYPE_OPTIONS}
                onChange={field.onChange}
                modalTitle="出品元を選択"
              />
            )}
          />

          <View style={twoColumn}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="candidateCurrentPrice"
                render={({ field }) => (
                  <TextField
                    label="現在価格 (円)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="candidateShippingFee"
                render={({ field }) => (
                  <TextField
                    label="送料 (円)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
          </View>

          <View style={readonlyRow}>
            <Text style={readonlyLabel}>合計 (自動計算)</Text>
            <Text style={readonlyValue}>
              {candidateTotalPreview !== undefined
                ? `¥${candidateTotalPreview.toLocaleString()}`
                : '—'}
            </Text>
          </View>

          <Controller
            control={control}
            name="auctionEndsAt"
            render={({ field }) => (
              <TextField
                label="終了日時 (YYYY-MM-DDTHH:mm)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="2026-04-30T22:00"
                autoCapitalize="none"
                hint="ISO 8601 表記。例: 2026-04-30T22:00"
              />
            )}
          />

          <View style={twoColumn}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="easyBuyPrice"
                render={({ field }) => (
                  <TextField
                    label="即決価格 (円)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                    hint="この値段ならすぐ買う"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="acceptablePrice"
                render={({ field }) => (
                  <TextField
                    label="許容価格 (円)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                    hint="この値段なら検討"
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="maxBidPrice"
            render={({ field }) => (
              <TextField
                label="上限価格 (円)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                hint="絶対に超えない上限"
              />
            )}
          />

          <Controller
            control={control}
            name="sellerName"
            render={({ field }) => (
              <TextField
                label="出品者"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          <Controller
            control={control}
            name="listingDescription"
            render={({ field }) => (
              <TextField
                label="出品説明"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                multiline
              />
            )}
          />
        </>
      )}

      {isOwned && (
        <>
          <SectionTitle>購入情報</SectionTitle>

          <View style={twoColumn}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="purchasePrice"
                render={({ field }) => (
                  <TextField
                    label="購入価格 (円)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="shippingFee"
                render={({ field }) => (
                  <TextField
                    label="送料 (円)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="purchaseDate"
            render={({ field }) => (
              <TextField
                label="購入日 (YYYY-MM-DD)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="2026-04-26"
                autoCapitalize="none"
              />
            )}
          />

          <Controller
            control={control}
            name="purchaseSource"
            render={({ field }) => (
              <TextField
                label="購入元"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="ヤフオク / メルカリ / etc."
              />
            )}
          />

          <Controller
            control={control}
            name="productUrl"
            render={({ field }) => (
              <TextField
                label="商品 URL"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.productUrl?.message}
                keyboardType="url"
                autoCapitalize="none"
              />
            )}
          />
        </>
      )}

      {!isOwned && !isCandidate && (
        <>
          <SectionTitle>参考リンク</SectionTitle>
          <Controller
            control={control}
            name="productUrl"
            render={({ field }) => (
              <TextField
                label="商品 URL"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.productUrl?.message}
                keyboardType="url"
                autoCapitalize="none"
              />
            )}
          />
        </>
      )}

      <SectionTitle>タグ</SectionTitle>
      <TagInput values={tags} onChange={setTags} suggestions={tagSuggestions} />

      <SectionTitle>Fit Anchor</SectionTitle>
      <Controller
        control={control}
        name="isFitAnchor"
        render={({ field }) => (
          <View style={anchorRow}>
            <Text style={anchorLabel}>Fit Anchor として登録</Text>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />
      {watchedIsFitAnchor && (
        <>
          <Controller
            control={control}
            name="fitAnchorName"
            render={({ field }) => (
              <TextField
                label="Anchor 名"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: ベスト パーカー / 基準"
                hint="未入力ならアイテム名が使われます"
              />
            )}
          />
          <Controller
            control={control}
            name="fitAnchorNotes"
            render={({ field }) => (
              <TextField
                label="Anchor メモ"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                multiline
              />
            )}
          />
        </>
      )}

      <SectionTitle>メモ</SectionTitle>
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            multiline
          />
        )}
      />

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <Button label={submitLabel} onPress={() => void submit()} loading={submitting} />
        {onCancel && <Button label="キャンセル" onPress={onCancel} variant="ghost" />}
      </View>
    </ScrollView>
  );
};

const SectionTitle = ({ children }: { children: string }) => (
  <Text style={sectionTitleStyle}>{children}</Text>
);

const sectionTitleStyle = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  fontWeight: font.weight.semibold,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginTop: space.lg,
  marginBottom: space.md,
} as const;

const twoColumn: ViewStyle = {
  flexDirection: 'row',
  gap: space.md,
};

const anchorRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  marginBottom: space.md,
};

const anchorLabel = {
  fontSize: font.size.md,
  color: colors.text,
  fontWeight: font.weight.medium,
} as const;

const readonlyRow: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  marginBottom: space.md,
  backgroundColor: colors.surface,
};

const readonlyLabel = {
  fontSize: font.size.sm,
  color: colors.textMuted,
  fontWeight: font.weight.medium,
} as const;

const readonlyValue = {
  fontSize: font.size.md,
  color: colors.text,
  fontWeight: font.weight.semibold,
} as const;
