import { View } from 'react-native';

import { lip, palette, type WorldTone } from './theme';

// A flat-topped regular hexagon `size` wide, from one vertex to the opposite vertex.
// Three rectangles cover it: each one is one side wide and the hexagon high,
// and they turn by 0, 60 and 120 degrees about the center.
function Hexagon({ size, color }: { readonly size: number; readonly color: string }) {
  const side = size / 2;
  const height = side * Math.sqrt(3);
  return (
    <View style={{ width: size, height }}>
      {[0, 60, 120].map((angle) => (
        <View
          key={angle}
          style={{
            position: 'absolute',
            left: side / 2,
            top: 0,
            width: side,
            height,
            backgroundColor: color,
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      ))}
    </View>
  );
}

// The hex stone of one world: the stone in its tone, a light inner face and a shade below it.
// A pressed stone sinks onto its shade. The stone is decoration: the screen reader skips it.
export function HexStone({
  size,
  colors,
  pressed = false,
}: {
  readonly size: number;
  readonly colors: WorldTone;
  readonly pressed?: boolean;
}) {
  const height = (size / 2) * Math.sqrt(3);
  const inner = size * 0.56;
  return (
    <View
      style={{ width: size, height: height + lip.md }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ position: 'absolute', top: lip.md }}>
        <Hexagon size={size} color={palette.shade} />
      </View>
      <View style={{ transform: [{ translateY: pressed ? lip.md : 0 }] }}>
        <Hexagon size={size} color={colors.tone} />
        <View style={{ position: 'absolute', left: (size - inner) / 2, top: height * 0.22 }}>
          <Hexagon size={inner} color={colors.wash} />
        </View>
      </View>
    </View>
  );
}
