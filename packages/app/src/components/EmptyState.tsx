import { Text, View, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { font, space, useThemeColors } from '../theme';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** testID forwarded to the action button (when present). */
  actionTestID?: string;
};

export const EmptyState = ({ title, message, actionLabel, onAction, actionTestID }: Props) => {
  const palette = useThemeColors();
  return (
    <View style={wrapper}>
      <Text style={[titleStyle, { color: palette.text }]}>{title}</Text>
      {message !== undefined && message !== '' && (
        <Text style={[messageStyle, { color: palette.textMuted }]}>{message}</Text>
      )}
      {actionLabel !== undefined && onAction !== undefined && (
        <View style={{ marginTop: space.lg }}>
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
            testID={actionTestID}
          />
        </View>
      )}
    </View>
  );
};

const wrapper: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: space.xl,
  paddingVertical: space.xxl,
};

const titleStyle = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  textAlign: 'center' as const,
} as const;

const messageStyle = {
  marginTop: space.sm,
  fontSize: font.size.sm,
  textAlign: 'center' as const,
  lineHeight: 20,
} as const;
