/**
 * Lightweight SVG price chart — no chart library is bundled.
 * Renders either a candle view or an area/line view from real `Kline` data
 * returned by `/api/market/klines`. It never synthesises points: if the
 * backend returns an empty series the caller shows an honest empty state.
 */

import { useId, useMemo, useState } from 'react';
import type { Kline } from '../api';
import { price as fmtPrice } from '../utils/format';

type Props = {
  data: Kline[];
  /** 'candles' for the terminal, 'area' for compact contexts. */
  variant?: 'candles' | 'area';
  height?: number;
  upColor?: string;
  downColor?: string;
  showAxis?: boolean;
};

const PAD = { top: 10, right: 62, bottom: 18, left: 8 };

export function PriceChart({
  data,
  variant = 'candles',
  height = 320,
  showAxis = true,
}: Props) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 900; // viewBox width; CSS scales it to the container

  const model = useMemo(() => {
    if (!data.length) return null;
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const span = max - min || Math.abs(max) * 0.001 || 1;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const step = plotW / Math.max(1, data.length - 1);

    const x = (index: number) => PAD.left + index * step;
    const y = (value: number) => PAD.top + plotH - ((value - min) / span) * plotH;

    const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(d.close).toFixed(2)}`).join(' ');
    const area = `${line} L${x(data.length - 1).toFixed(2)},${(PAD.top + plotH).toFixed(2)} L${PAD.left.toFixed(2)},${(PAD.top + plotH).toFixed(2)} Z`;

    const bodyW = Math.max(1.5, Math.min(11, step * 0.62));
    const rising = data[data.length - 1].close >= data[0].open;

    // Four horizontal gridlines with their price labels.
    const grid = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
      const value = min + span * fraction;
      return { value, y: y(value) };
    });

    return { max, min, x, y, line, area, bodyW, rising, grid, plotH, step };
  }, [data, height]);

  if (!model) return null;

  const up = 'var(--up)';
  const down = 'var(--down)';
  const active = hover !== null ? data[hover] : data[data.length - 1];
  const accent = model.rising ? up : down;

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const index = Math.round((ratio * width - PAD.left) / model.step);
    setHover(Math.max(0, Math.min(data.length - 1, index)));
  };

  return (
    <div className="chart-box" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price chart, ${data.length} candles, last ${fmtPrice(active.close)}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {showAxis &&
          model.grid.map((g) => (
            <g key={g.value}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={g.y}
                y2={g.y}
                stroke="var(--line-hair)"
                strokeWidth="1"
              />
              <text
                x={width - PAD.right + 8}
                y={g.y + 4}
                fill="var(--text-faint)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {fmtPrice(g.value)}
              </text>
            </g>
          ))}

        {variant === 'area' ? (
          <>
            <path d={model.area} fill={`url(#${gradientId})`} />
            <path d={model.line} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d={model.area} fill={`url(#${gradientId})`} opacity="0.5" />
            {data.map((d, i) => {
              const rising = d.close >= d.open;
              const color = rising ? up : down;
              const top = model.y(Math.max(d.open, d.close));
              const bottom = model.y(Math.min(d.open, d.close));
              const cx = model.x(i);
              return (
                <g key={d.time} opacity={hover === null || hover === i ? 1 : 0.55}>
                  <line x1={cx} x2={cx} y1={model.y(d.high)} y2={model.y(d.low)} stroke={color} strokeWidth="1" />
                  <rect
                    x={cx - model.bodyW / 2}
                    y={top}
                    width={model.bodyW}
                    height={Math.max(1, bottom - top)}
                    fill={color}
                    rx="0.6"
                  />
                </g>
              );
            })}
          </>
        )}

        {hover !== null && (
          <line
            x1={model.x(hover)}
            x2={model.x(hover)}
            y1={PAD.top}
            y2={PAD.top + model.plotH}
            stroke="var(--line-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Last-price marker */}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={model.y(active.close)}
          y2={model.y(active.close)}
          stroke={accent}
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.65"
        />
      </svg>

      <div
        className="xs mono"
        style={{
          position: 'absolute',
          top: 6,
          left: 10,
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          background: 'rgba(6,8,11,.7)',
          padding: '3px 8px',
          borderRadius: 'var(--r-xs)',
        }}
      >
        O {fmtPrice(active.open)} · H {fmtPrice(active.high)} · L {fmtPrice(active.low)} ·{' '}
        <strong style={{ color: accent }}>C {fmtPrice(active.close)}</strong>
      </div>
    </div>
  );
}

/** Compact sparkline for market rows and cards. */
export function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const id = useId();
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const w = 120;
  const h = 34;
  const step = w / (data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(' ');
  const color = up ? 'var(--up)' : 'var(--down)';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
