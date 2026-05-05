import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { CATEGORY_LABEL, ITEM_STATUS_LABEL, type GarmentItem, type SaleInfo } from '@seam/shared';
import { Chip, type ChipTone } from './Chip';
import { absolutePathFor } from '../photos/savePhoto';
import { type ColorPalette, font, radii, space, useThemeColors } from '../theme';

type Props = {
  item: GarmentItem;
  thumbnailRelativePath?: string;
  /** Optional wear count to display as a chip; pass when known to highlight unworn items. */
  wearCount?: number;
  /** Sold-context info. When item.status === 'sold' and this is provided, sold metrics are shown. */
  saleInfo?: SaleInfo;
  /** soldPrice / totalPrice. Pass alongside `saleInfo` to render a recovery-rate chip. */
  recoveryRate?: number;
  /** Right-aligned primary label, e.g. "¥4,000". Used on wishlist rows. */
  priceLabel?: string;
  /** Right-aligned secondary label below `priceLabel`, e.g. auction end time. */
  endsLabel?: string;
  onPress?: () => void;
  testID?: string;
};

const formatYen = (n?: number): string => (n !== undefined ? `¥${n.toLocaleString()}` : '—');

const formatYearMonthDay = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.length >= 10 ? iso.slice(0, 10) : iso;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const recoveryTone = (rate: number): ChipTone => {
  if (rate >= 0.8) return 'default';
  if (rate < 0.4) return 'warning';
  return 'muted';
};

export const ItemCard = ({
  item,
  thumbnailRelativePath,
  wearCount,
  saleInfo,
  recoveryRate,
  priceLabel,
  endsLabel,
  onPress,
  testID,
}: Props) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const isSold = item.status === 'sold';
  const subtitleParts = [item.brand, item.sizeLabel, CATEGORY_LABEL[item.category]].filter(
    (p): p is string => Boolean(p),
  );
  const isUnworn = !isSold && item.status === 'owned' && wearCount !== undefined && wearCount === 0;

  const soldDate = isSold ? formatYearMonthDay(saleInfo?.soldAt) : undefined;
  const soldMetaParts = [soldDate, saleInfo?.soldSource].filter((p): p is string => Boolean(p));

  const content = (
    <View style={styles.card}>
      <View style={styles.thumbBox}>
        {thumbnailRelativePath ? (
          <Image
            source={{ uri: absolutePathFor(thumbnailRelativePath) }}
            style={thumbImg}
            accessible
            accessibilityLabel={`${item.name} の写真`}
          />
        ) : (
          <Text style={styles.thumbPlaceholder}>—</Text>
        )}
      </View>
      <View style={textBox}>
        <View style={headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {!isSold && item.isFitAnchor && <Chip label="Anchor" tone="inverse" />}
        </View>
        {subtitleParts.length > 0 && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        )}
        {isSold && soldMetaParts.length > 0 && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {soldMetaParts.join(' · ')}
          </Text>
        )}
        <View style={badgeRow}>
          <Chip label={ITEM_STATUS_LABEL[item.status]} tone="muted" />
          {!isSold && item.favoriteScore !== undefined && (
            <Chip label={`★ ${item.favoriteScore}`} tone="default" />
          )}
          {!isSold && item.isSellCandidate && <Chip label="売却候補" tone="warning" />}
          {!isSold && wearCount !== undefined && item.status === 'owned' && (
            <Chip
              label={isUnworn ? '未着用' : `着用 ${wearCount}回`}
              tone={isUnworn ? 'warning' : 'default'}
            />
          )}
          {isSold && saleInfo?.soldPrice !== undefined && (
            <Chip label={`売却 ${formatYen(saleInfo.soldPrice)}`} tone="default" />
          )}
          {isSold && recoveryRate !== undefined && (
            <Chip
              label={`回収 ${Math.round(recoveryRate * 100)}%`}
              tone={recoveryTone(recoveryRate)}
            />
          )}
        </View>
      </View>
      {(priceLabel !== undefined || endsLabel !== undefined) && (
        <View style={priceBox}>
          {priceLabel !== undefined && <Text style={styles.priceText}>{priceLabel}</Text>}
          {endsLabel !== undefined && (
            <Text style={styles.endsText} numberOfLines={1}>
              {endsLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

const thumbImg = {
  width: '100%' as const,
  height: '100%' as const,
};

const textBox: ViewStyle = {
  flex: 1,
  justifyContent: 'center',
  gap: space.xs,
};

const headerRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
};

const badgeRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.xs,
  marginTop: space.xs,
};

const priceBox: ViewStyle = {
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: space.xs,
  marginLeft: space.sm,
};

const makeStyles = (p: ColorPalette) => ({
  card: {
    flexDirection: 'row' as const,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
    backgroundColor: p.bg,
    gap: space.md,
  } satisfies ViewStyle,
  thumbBox: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: p.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  } satisfies ViewStyle,
  thumbPlaceholder: {
    color: p.textMuted,
    fontSize: font.size.lg,
  } as const,
  name: {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: p.text,
  } as const,
  subtitle: {
    fontSize: font.size.sm,
    color: p.textMuted,
  } as const,
  priceText: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: p.text,
  } as const,
  endsText: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
});
