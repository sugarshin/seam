import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { CATEGORY_LABEL, ITEM_STATUS_LABEL, type GarmentItem } from '@seam/shared';
import { Chip } from './Chip';
import { absolutePathFor } from '../photos/savePhoto';
import { colors, font, radii, space } from '../theme';

type Props = {
  item: GarmentItem;
  thumbnailRelativePath?: string;
  /** Optional wear count to display as a chip; pass when known to highlight unworn items. */
  wearCount?: number;
  onPress?: () => void;
};

export const ItemCard = ({ item, thumbnailRelativePath, wearCount, onPress }: Props) => {
  const subtitleParts = [item.brand, item.sizeLabel, CATEGORY_LABEL[item.category]].filter(
    (p): p is string => Boolean(p),
  );
  const isUnworn = item.status === 'owned' && wearCount !== undefined && wearCount === 0;
  const content = (
    <View style={card}>
      <View style={thumbBox}>
        {thumbnailRelativePath ? (
          <Image
            source={{ uri: absolutePathFor(thumbnailRelativePath) }}
            style={thumbImg}
            accessible
            accessibilityLabel={`${item.name} の写真`}
          />
        ) : (
          <Text style={thumbPlaceholder}>—</Text>
        )}
      </View>
      <View style={textBox}>
        <View style={headerRow}>
          <Text style={nameStyle} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isFitAnchor && <Chip label="Anchor" tone="inverse" />}
        </View>
        {subtitleParts.length > 0 && (
          <Text style={subtitleStyle} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        )}
        <View style={badgeRow}>
          <Chip label={ITEM_STATUS_LABEL[item.status]} tone="muted" />
          {item.favoriteScore !== undefined && (
            <Chip label={`★ ${item.favoriteScore}`} tone="default" />
          )}
          {item.isSellCandidate && <Chip label="売却候補" tone="warning" />}
          {wearCount !== undefined && item.status === 'owned' && (
            <Chip
              label={isUnworn ? '未着用' : `着用 ${wearCount}回`}
              tone={isUnworn ? 'warning' : 'default'}
            />
          )}
        </View>
      </View>
    </View>
  );
  if (onPress) {
    const labelParts = [item.name, ...subtitleParts, ITEM_STATUS_LABEL[item.status]];
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labelParts.join(', ')}
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

const card: ViewStyle = {
  flexDirection: 'row',
  paddingVertical: space.md,
  paddingHorizontal: space.lg,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  backgroundColor: colors.bg,
  gap: space.md,
};

const thumbBox: ViewStyle = {
  width: 72,
  height: 72,
  borderRadius: radii.md,
  backgroundColor: colors.surface,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const thumbImg = {
  width: '100%' as const,
  height: '100%' as const,
};

const thumbPlaceholder = {
  color: colors.textMuted,
  fontSize: font.size.lg,
} as const;

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

const nameStyle = {
  flex: 1,
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: colors.text,
} as const;

const subtitleStyle = {
  fontSize: font.size.sm,
  color: colors.textMuted,
} as const;

const badgeRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.xs,
  marginTop: space.xs,
};
