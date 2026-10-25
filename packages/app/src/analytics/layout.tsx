import type { ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { type ColorPalette, font, space, useThemeColors } from '../theme';

export const Section = ({
  title,
  subtitle,
  children,
  testID,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
}) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  return (
    <View style={{ gap: space.sm }} testID={testID}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle !== undefined && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
};

/** Sub-heading inside a section (e.g. "点数" / "金額" above two bar lists). */
export const SubHeading = ({ children }: { children: string }) => {
  const palette = useThemeColors();
  return <Text style={makeStyles(palette).subHeading}>{children}</Text>;
};

/** Muted footnote, e.g. how many items were excluded for missing data. */
export const Note = ({ children }: { children: string }) => {
  const palette = useThemeColors();
  return <Text style={makeStyles(palette).note}>{children}</Text>;
};

export type MetricRowItem = {
  id: string;
  label: string;
  sublabel?: string;
  trailing?: string;
  onPress?: () => void;
  testID?: string;
};

/** Unranked label / detail / value rows. Rows with `onPress` show a chevron. */
export const MetricRows = ({ items }: { items: readonly MetricRowItem[] }) => {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  return (
    <View>
      {items.map((it) => {
        const content = (
          <View style={styles.row}>
            <View style={textCol}>
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
              </Text>
              {it.sublabel !== undefined && it.sublabel !== '' && (
                <Text style={styles.sublabel}>{it.sublabel}</Text>
              )}
            </View>
            {it.trailing !== undefined && <Text style={styles.trailing}>{it.trailing}</Text>}
            {it.onPress && <Text style={styles.chevron}>›</Text>}
          </View>
        );
        return it.onPress ? (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            testID={it.testID}
            onPress={it.onPress}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            {content}
          </Pressable>
        ) : (
          <View key={it.id} testID={it.testID}>
            {content}
          </View>
        );
      })}
    </View>
  );
};

export const cardsRow: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: space.sm,
};

const textCol: ViewStyle = {
  flex: 1,
  gap: 2,
};

const makeStyles = (p: ColorPalette) => ({
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: p.text,
  } as const,
  sectionSubtitle: {
    fontSize: font.size.xs,
    color: p.textMuted,
    marginTop: 2,
  } as const,
  subHeading: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: p.text,
    marginTop: space.xs,
  } as const,
  note: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: space.sm,
    gap: space.md,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  label: {
    fontSize: font.size.sm,
    color: p.text,
    fontWeight: font.weight.medium,
  } as const,
  sublabel: {
    fontSize: font.size.xs,
    color: p.textMuted,
  } as const,
  trailing: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: p.text,
  } as const,
  chevron: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: p.textMuted,
  } as const,
});
