import { useRef, useState, type ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { font, space, useThemeColors } from '../theme';

// カードはこの幅で止まり、止まった位置で離すと実行される。
const ACTION_WIDTH = 96;
// ライブラリ既定のばねは戻りに約 1 秒かかるので、臨界減衰で素早く戻す。
const RETURN_SPRING = { mass: 1, damping: 40, stiffness: 400 };

type Props = {
  wornToday: boolean;
  onToggleWornToday: () => void;
  onRecordWithDetails: () => void;
  children: ReactNode;
};

export const WearSwipeRow = ({
  wornToday,
  onToggleWornToday,
  onRecordWithDetails,
  children,
}: Props) => {
  const palette = useThemeColors();
  const swipeable = useRef<SwipeableMethods>(null);
  // 記録はカードが戻りきる前に反映されるので、戻る間は離した時点のアクション表示を保つ。
  const [heldWornToday, setHeldWornToday] = useState<boolean | null>(null);
  const actionWornToday = heldWornToday ?? wornToday;

  // アクションを開いたまま止めず、離した時点で実行してカードを戻す。
  const handleWillOpen = (direction: SwipeDirection.LEFT | SwipeDirection.RIGHT) => {
    setHeldWornToday(wornToday);
    swipeable.current?.close();
    if (direction === SwipeDirection.RIGHT) {
      onToggleWornToday();
    } else {
      onRecordWithDetails();
    }
  };

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      leftThreshold={ACTION_WIDTH}
      rightThreshold={ACTION_WIDTH}
      overshootLeft={false}
      overshootRight={false}
      animationOptions={RETURN_SPRING}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableClose={() => setHeldWornToday(null)}
      // 戻っている途中に次のスワイプを始めると onSwipeableClose が呼ばれないので、ここでも解除する。
      onSwipeableOpenStartDrag={() => setHeldWornToday(null)}
      // 押下中のカードは半透明になるので、背面を不透明にしてアクションが透けないようにする。
      childrenContainerStyle={{ backgroundColor: palette.bg }}
      renderLeftActions={() => (
        <SwipeAction
          label={actionWornToday ? '取り消す' : '✓ 着た'}
          backgroundColor={actionWornToday ? palette.warning : palette.bgInverse}
          color={palette.textInverse}
        />
      )}
      renderRightActions={() => (
        <SwipeAction label="日付を指定" backgroundColor={palette.surfaceAlt} color={palette.text} />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
};

type SwipeActionProps = {
  label: string;
  backgroundColor: string;
  color: string;
};

const SwipeAction = ({ label, backgroundColor, color }: SwipeActionProps) => (
  <View style={[action, { backgroundColor }]} accessibilityElementsHidden>
    <Text style={[actionLabel, { color }]}>{label}</Text>
  </View>
);

const action: ViewStyle = {
  width: ACTION_WIDTH,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: space.xs,
};

const actionLabel = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
} as const;
