import React from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Line,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { font, spacing, radius, useTheme } from '@/theme';
import { withAlpha } from '@/components/glass';

/**
 * Dependency-light SVG chart kit (react-native-svg only). Every chart is
 * theme-reactive and renders gracefully with empty data. Charts intentionally
 * avoid animation libraries to keep the bundle small and Expo-Go friendly.
 */

// ─── shared types ────────────────────────────────────────────────────────────
export interface Slice {
  label: string;
  value: number;
  color: string;
}
export interface SeriesPoint {
  label: string;
  value: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DonutChart — categorical breakdown with a center total + legend
// ═══════════════════════════════════════════════════════════════════════════
export function DonutChart({
  data,
  size = 150,
  thickness = 20,
  centerLabel,
  centerValue,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segments =
    total > 0
      ? data
          .filter((d) => d.value > 0)
          .map((d) => {
            const frac = d.value / total;
            const seg = { ...d, frac, dash: frac * circ, offset };
            offset += frac * circ;
            return seg;
          })
      : [];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${c}, ${c}`}>
            {/* track */}
            <Circle cx={c} cy={c} r={r} stroke={colors.cardAlt} strokeWidth={thickness} fill="none" />
            {segments.map((s, i) => (
              <Circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                stroke={s.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${s.dash} ${circ - s.dash}`}
                strokeDashoffset={-s.offset}
                strokeLinecap="butt"
              />
            ))}
          </G>
          {centerValue ? (
            <SvgText
              x={c}
              y={c - (centerLabel ? 2 : -6)}
              fontSize={font.xl}
              fontWeight="800"
              fill={colors.text}
              textAnchor="middle"
            >
              {centerValue}
            </SvgText>
          ) : null}
          {centerLabel ? (
            <SvgText x={c} y={c + 16} fontSize={font.xs} fill={colors.textFaint} textAnchor="middle">
              {centerLabel}
            </SvgText>
          ) : null}
        </Svg>
      </View>

      {/* Legend */}
      <View style={{ flex: 1, gap: 6 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: d.color }} />
            <Text style={{ color: colors.textMuted, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '700' }}>{d.value}</Text>
          </View>
        ))}
        {total === 0 ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sm }}>No data yet.</Text>
        ) : null}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ProgressRing — single-value gauge (e.g. task completion rate)
// ═══════════════════════════════════════════════════════════════════════════
export function ProgressRing({
  percent,
  size = 120,
  thickness = 12,
  color,
  label,
}: {
  percent: number; // 0–100
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;
  const ringColor = color ?? colors.accent;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringColor} />
            <Stop offset="1" stopColor={withAlpha(ringColor, 0.6)} />
          </SvgGradient>
        </Defs>
        <G rotation={-90} origin={`${c}, ${c}`}>
          <Circle cx={c} cy={c} r={r} stroke={colors.cardAlt} strokeWidth={thickness} fill="none" />
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
          />
        </G>
        <SvgText x={c} y={c + 2} fontSize={font.xl} fontWeight="800" fill={colors.text} textAnchor="middle">
          {`${Math.round(clamped)}%`}
        </SvgText>
        {label ? (
          <SvgText x={c} y={c + 20} fontSize={font.xs} fill={colors.textFaint} textAnchor="middle">
            {label}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GroupedBarChart — e.g. monthly income vs expenses
// ═══════════════════════════════════════════════════════════════════════════
export function GroupedBarChart({
  labels,
  seriesA,
  seriesB,
  colorA,
  colorB,
  height = 180,
  formatValue,
  legendA,
  legendB,
}: {
  labels: string[];
  seriesA: number[];
  seriesB?: number[];
  colorA?: string;
  colorB?: string;
  height?: number;
  formatValue?: (n: number) => string;
  legendA?: string;
  legendB?: string;
}) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const cA = colorA ?? colors.chart[0];
  const cB = colorB ?? colors.chart[1];
  const grouped = !!seriesB;

  const all = [...seriesA, ...(seriesB ?? [])];
  const max = Math.max(1, ...all);
  const chartH = height - 28; // leave room for x labels
  const n = labels.length;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View>
      {(legendA || legendB) && (
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm }}>
          {legendA ? <LegendDot color={cA} label={legendA} /> : null}
          {legendB ? <LegendDot color={cB} label={legendB} /> : null}
        </View>
      )}
      <View onLayout={onLayout} style={{ height }}>
        {w > 0 && n > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <SvgGradient id="barA" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={cA} />
                <Stop offset="1" stopColor={withAlpha(cA, 0.5)} />
              </SvgGradient>
              <SvgGradient id="barB" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={cB} />
                <Stop offset="1" stopColor={withAlpha(cB, 0.5)} />
              </SvgGradient>
            </Defs>
            {/* gridlines */}
            {[0.25, 0.5, 0.75].map((g) => (
              <Line
                key={g}
                x1={0}
                x2={w}
                y1={chartH * g}
                y2={chartH * g}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            ))}
            {labels.map((lab, i) => {
              const slot = w / n;
              const groupW = slot * 0.6;
              const barW = grouped ? groupW / 2 - 1 : groupW;
              const x0 = i * slot + (slot - groupW) / 2;
              const hA = Math.max(2, (seriesA[i] / max) * (chartH - 4));
              const hB = grouped ? Math.max(2, ((seriesB?.[i] ?? 0) / max) * (chartH - 4)) : 0;
              return (
                <G key={i}>
                  <Rect
                    x={x0}
                    y={chartH - hA}
                    width={barW}
                    height={hA}
                    rx={3}
                    fill="url(#barA)"
                  />
                  {grouped ? (
                    <Rect
                      x={x0 + barW + 2}
                      y={chartH - hB}
                      width={barW}
                      height={hB}
                      rx={3}
                      fill="url(#barB)"
                    />
                  ) : null}
                  <SvgText
                    x={i * slot + slot / 2}
                    y={height - 8}
                    fontSize={10}
                    fill={colors.textDim}
                    textAnchor="middle"
                  >
                    {lab}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AreaChart — smooth-ish filled line for a single time series
// ═══════════════════════════════════════════════════════════════════════════
export function AreaChart({
  values,
  labels,
  color,
  height = 160,
}: {
  values: number[];
  labels?: string[];
  color?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const stroke = color ?? colors.accent;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const chartH = height - 22;
  const n = values.length;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const pts = w > 0 && n > 0
    ? values.map((v, i) => {
        const x = n === 1 ? w / 2 : (i / (n - 1)) * w;
        const y = chartH - ((v - min) / range) * (chartH - 6) - 3;
        return { x, y };
      })
    : [];

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = pts.length
    ? `${linePath} L${pts[pts.length - 1].x},${chartH} L${pts[0].x},${chartH} Z`
    : '';

  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && n > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={withAlpha(stroke, 0.35)} />
              <Stop offset="1" stopColor={withAlpha(stroke, 0.02)} />
            </SvgGradient>
          </Defs>
          {[0.33, 0.66].map((g) => (
            <Line key={g} x1={0} x2={w} y1={chartH * g} y2={chartH * g} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
          ))}
          <Path d={areaPath} fill="url(#areaFill)" />
          <Path d={linePath} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={n <= 12 ? 3 : 0} fill={stroke} />
          ))}
          {labels && labels.length ? (
            <>
              <SvgText x={0} y={height - 4} fontSize={10} fill={colors.textDim} textAnchor="start">
                {labels[0]}
              </SvgText>
              <SvgText x={w} y={height - 4} fontSize={10} fill={colors.textDim} textAnchor="end">
                {labels[labels.length - 1]}
              </SvgText>
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BarList — ranked horizontal bars (top pages / referrers / etc.)
// ═══════════════════════════════════════════════════════════════════════════
export function BarList({
  rows,
  emptyLabel = 'No data.',
  formatValue,
}: {
  rows: { key: string; count: number }[];
  emptyLabel?: string;
  formatValue?: (n: number) => string;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.count));
  const fmt = formatValue ?? ((n: number) => String(n));
  if (rows.length === 0) {
    return <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{emptyLabel}</Text>;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r, i) => (
        <View key={`${r.key}-${i}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: colors.text, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
              {r.key || '(none)'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: font.sm, fontWeight: '700', marginLeft: 8 }}>
              {fmt(r.count)}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.round((r.count / max) * 100)}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: colors.chart[i % colors.chart.length],
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── LegendDot ───────────────────────────────────────────────────────────────
export function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: colors.textMuted, fontSize: font.xs, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
