import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  MAJOR_CATEGORIES,
  MAJOR_CATEGORY_LABEL,
  majorCategoryOf,
  type MajorCategory,
} from '@seam/shared';
import { Chip } from '../../src/components';
import {
  MajorCategoryView,
  OverviewView,
  loadAnalyticsData,
  type AnalyticsData,
} from '../../src/analytics';
import { aggregateStats, type StatsSnapshot } from '../../src/stats';
import { type ColorPalette, font, space, useThemeColors } from '../../src/theme';
import { testIds } from '../../src/utils/testIds';

type Scope = 'all' | MajorCategory;

/** The five wardrobe groups get a tab; `other` stays inside the overview. */
const SCOPE_MAJORS = MAJOR_CATEGORIES.filter((m) => m !== 'other');

export default function AnalyticsScreen() {
  const palette = useThemeColors();
  const styles = makeStyles(palette);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const scrollRef = useRef<ScrollView>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, s] = await Promise.all([loadAnalyticsData(), aggregateStats()]);
      setData(d);
      setSnapshot(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const selectScope = useCallback((next: Scope) => {
    setScope(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const countByMajor = useMemo(() => {
    const counts: Partial<Record<MajorCategory, number>> = {};
    for (const it of data?.owned ?? []) {
      const m = majorCategoryOf(it.category);
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  if (data === null || snapshot === null) {
    return (
      <View style={styles.loadingWrap}>
        {loading ? (
          <ActivityIndicator color={palette.text} />
        ) : error !== null ? (
          <Text style={styles.error}>集計に失敗しました: {error}</Text>
        ) : (
          <Text style={styles.muted}>—</Text>
        )}
      </View>
    );
  }

  const scopeOptions: { value: Scope; label: string }[] = [
    { value: 'all', label: `全体 ${data.owned.length}` },
    ...SCOPE_MAJORS.map((m) => ({
      value: m,
      label: `${MAJOR_CATEGORY_LABEL[m]} ${countByMajor[m] ?? 0}`,
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scopeBar}
        contentContainerStyle={scopeRow}
      >
        {scopeOptions.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={opt.value === scope}
            onPress={() => selectScope(opt.value)}
            testID={testIds.segOption(testIds.seg.analyticsScope, opt.value)}
          />
        ))}
      </ScrollView>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl }}
      >
        {scope === 'all' ? (
          <OverviewView
            owned={data.owned}
            sold={data.sold}
            snapshot={snapshot}
            onSelectMajor={selectScope}
          />
        ) : (
          <MajorCategoryView major={scope} owned={data.owned} sold={data.sold} />
        )}
      </ScrollView>
    </View>
  );
}

const scopeRow: ViewStyle = {
  flexDirection: 'row',
  gap: space.xs,
  paddingHorizontal: space.lg,
  paddingVertical: space.sm,
};

const makeStyles = (p: ColorPalette) => ({
  loadingWrap: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: p.bg,
  } satisfies ViewStyle,
  scopeBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  } satisfies ViewStyle,
  muted: {
    color: p.textMuted,
    fontSize: font.size.sm,
  } as const,
  error: {
    color: p.warning,
    fontSize: font.size.sm,
    paddingHorizontal: space.lg,
    textAlign: 'center' as const,
  } as const,
});
