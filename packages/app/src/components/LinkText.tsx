import { useMemo } from 'react';
import { Linking, type StyleProp, Text, type TextStyle } from 'react-native';
import { font, useThemeColors } from '../theme';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const URL_REGEX = /https?:\/\/[^\s]+/g;
const TRAILING_PUNCT_REGEX = /[.,;:!?)\]}>'"]+$/;

type Segment = { type: 'text' | 'link'; value: string };

const buildSegments = (input: string): readonly Segment[] => {
  const segments: Segment[] = [];
  let lastIndex = 0;
  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = URL_REGEX.exec(input);
  while (match !== null) {
    const start = match.index;
    let url = match[0];
    let trailing = '';
    const tail = url.match(TRAILING_PUNCT_REGEX);
    if (tail) {
      trailing = tail[0];
      url = url.slice(0, url.length - trailing.length);
    }
    if (start > lastIndex) {
      segments.push({ type: 'text', value: input.slice(lastIndex, start) });
    }
    segments.push({ type: 'link', value: url });
    if (trailing) {
      segments.push({ type: 'text', value: trailing });
    }
    lastIndex = start + match[0].length;
    match = URL_REGEX.exec(input);
  }
  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }
  return segments;
};

export const LinkText = ({ children, style, linkStyle, numberOfLines }: Props) => {
  const palette = useThemeColors();
  const segments = useMemo(() => buildSegments(children), [children]);
  const defaultLinkStyle: TextStyle = {
    color: palette.accent,
    textDecorationLine: 'underline',
    fontWeight: font.weight.medium,
  };

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((s, i) =>
        s.type === 'link' ? (
          <Text
            key={`${i}-link`}
            style={[defaultLinkStyle, linkStyle]}
            onPress={() => {
              void Linking.openURL(s.value);
            }}
            accessibilityRole="link"
          >
            {s.value}
          </Text>
        ) : (
          <Text key={`${i}-text`}>{s.value}</Text>
        ),
      )}
    </Text>
  );
};
