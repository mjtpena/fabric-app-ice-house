import { useMemo } from 'react';

import { useThemeColors } from '@x10/shared/ui';

import type { LotEvaluation } from '../domain/thermal';
import type { Room } from '../model';

export type IceHouseLens = 'life' | 'mkt' | 'fefo' | 'category' | 'excursion';

export interface RoomSnapshot {
  room: Room;
  currentTempC: number;
  mktC: number;
  outOfRange: boolean;
  excursionCount: number;
  lots: LotEvaluation[];
}

export interface IceHouseStageProps {
  chambers: RoomSnapshot[];
  lens: IceHouseLens;
  focusedRoomId: string | null;
  focusedLotId: string | null;
  onSelectRoom: (roomId: string) => void;
  onSelectLot: (lotId: string) => void;
  fefoRankMap: Map<string, number>;
  scrubHoursAgo: number;
  onScrubChange: (hoursAgo: number) => void;
}

const CATEGORY_FILL: Record<string, { light: string; dark: string }> = {
  dairy: { light: '#38bdf8', dark: '#7dd3fc' },
  meat: { light: '#0284c7', dark: '#38bdf8' },
  chocolate: { light: '#a16207', dark: '#eab308' },
  bakery: { light: '#0d9488', dark: '#2dd4bf' },
  pharma: { light: '#6366f1', dark: '#818cf8' },
  produce: { light: '#0891b2', dark: '#22d3ee' },
};

export function IceHouseStage({
  chambers,
  lens,
  focusedRoomId,
  focusedLotId,
  onSelectRoom,
  onSelectLot,
  fefoRankMap,
  scrubHoursAgo,
  onScrubChange,
}: IceHouseStageProps) {
  const colors = useThemeColors();
  const isDark = colors.dark;

  const skyBg = isDark ? '#0b141d' : '#eaf2f7';
  const stoneOuter = isDark ? '#1e293b' : '#cbd5e1';
  const stoneInner = isDark ? '#141e2b' : '#e2e8f0';
  const stoneStroke = isDark ? '#334155' : '#94a3b8';
  const chamberBg = isDark ? '#0f1b29' : '#f1f5f9';
  const straw = isDark ? '#92400e' : '#d97706';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#475569';
  const warmTint = isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(217, 119, 6, 0.16)';

  // 5 chambers arranged in a 2-row stone cutaway: top row 3 chambers, bottom row 2 wider chambers
  const layout = useMemo(
    () => [
      { x: 56, y: 120, w: 274, h: 176 },
      { x: 344, y: 120, w: 274, h: 176 },
      { x: 632, y: 120, w: 274, h: 176 },
      { x: 56, y: 314, w: 418, h: 176 },
      { x: 488, y: 314, w: 418, h: 176 },
    ],
    [],
  );

  const scrubLabel =
    scrubHoursAgo === 0
      ? 'Now (live)'
      : scrubHoursAgo >= 24
        ? `${(scrubHoursAgo / 24).toFixed(1)}d ago`
        : `${scrubHoursAgo}h ago`;

  return (
    <div
      className="relative h-full w-[calc(100%-var(--side-w,0px))] select-none overflow-hidden"
      style={{ background: skyBg }}
      data-testid="ice-house-stage"
    >
      <svg
        viewBox="0 0 960 550"
        className="h-full w-full"
        role="img"
        aria-label="Ice House stone cutaway showing five cold chambers and ice-block shelf life"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="stoneShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor={isDark ? '#020617' : '#475569'} floodOpacity={isDark ? '0.6' : '0.2'} />
          </filter>
          <radialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Stone Ice House Gable Roof & Masonry Shell */}
        <g filter="url(#stoneShadow)">
          <path
            d="M 28 112 L 480 22 L 932 112 L 932 512 L 28 512 Z"
            fill={stoneOuter}
            stroke={stoneStroke}
            strokeWidth="2"
          />
          <path
            d="M 42 116 L 480 34 L 918 116 L 918 500 L 42 500 Z"
            fill={stoneInner}
            stroke={stoneStroke}
            strokeWidth="1"
          />
        </g>

        {/* Hanging Warm Lantern in the Gable */}
        <g>
          <line x1="480" y1="34" x2="480" y2="62" stroke={stoneStroke} strokeWidth="2" />
          <circle cx="480" cy="74" r="34" fill="url(#lanternGlow)" />
          <rect x="473" y="64" width="14" height="18" rx="3" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
          <text x="480" y="102" textAnchor="middle" fill={textMuted} fontSize="10" fontWeight="700" letterSpacing="0.12em">
            ICE HOUSE CUTAWAY · {scrubLabel.toUpperCase()}
          </text>
        </g>

        {/* 5 Cold Chambers */}
        {chambers.slice(0, 5).map((ch, idx) => {
          const box = layout[idx];
          const isFocusedRoom = focusedRoomId === ch.room.id;
          const isDimmed = focusedRoomId !== null && !isFocusedRoom;
          // Frost thickness scales with colder setpoints (deep freeze -18°C = thick frost, chocolate 15°C = minimal)
          const frostWidth = Math.max(2, Math.min(10, Math.round((16 - ch.room.setpointC) / 3.5)));
          const visibleLots = ch.lots.filter((l) => l.lot.status !== 'discarded').slice(0, 9);
          const shelfY = box.y + box.h - 24;
          const maxBlockH = 82;
          const slotW = Math.floor((box.w - 28) / Math.max(1, visibleLots.length));
          const blockW = Math.max(14, Math.min(34, slotW - 6));

          return (
            <g
              key={ch.room.id}
              opacity={isDimmed ? 0.42 : 1}
              className="cursor-pointer transition-opacity duration-200"
              onClick={() => onSelectRoom(ch.room.id)}
              data-testid={`chamber-${idx}`}
              data-out-of-range={ch.outOfRange ? 'true' : 'false'}
            >
              {/* Chamber recessed masonry cavity */}
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx="8"
                fill={chamberBg}
                stroke={isFocusedRoom ? (isDark ? '#22d3ee' : '#0891b2') : stoneStroke}
                strokeWidth={isFocusedRoom ? 2.5 : 1.5}
              />

              {/* Frost rim thickening with colder setpoints */}
              <rect
                x={box.x + 2}
                y={box.y + 2}
                width={box.w - 4}
                height={box.h - 4}
                rx="6"
                fill="none"
                stroke={isDark ? '#a5f3fc' : '#67e8f9'}
                strokeWidth={frostWidth}
                strokeOpacity={ch.room.kind === 'frozen' ? 0.55 : ch.room.kind === 'chilled' ? 0.32 : 0.1}
              />

              {/* Excursion warm tint down the chamber wall */}
              {(ch.outOfRange || ch.excursionCount > 0) && (
                <rect
                  x={box.x + 4}
                  y={box.y + 4}
                  width={box.w - 8}
                  height={box.h - 8}
                  rx="6"
                  fill={warmTint}
                />
              )}

              {/* Chamber Header + Door Thermometer */}
              <text x={box.x + 12} y={box.y + 21} fill={textMain} fontSize="12" fontWeight="700">
                {ch.room.name}
              </text>
              <text x={box.x + 12} y={box.y + 35} fill={textMuted} fontSize="10" fontFamily="monospace">
                Set {ch.room.setpointC}°C · MKT {ch.mktC.toFixed(1)}°C
              </text>

              {/* Door Thermometer pill */}
              <rect
                x={box.x + box.w - 72}
                y={box.y + 10}
                width="60"
                height="22"
                rx="11"
                fill={ch.outOfRange ? (isDark ? '#78350f' : '#fef3c7') : isDark ? '#164e63' : '#cffafe'}
                stroke={ch.outOfRange ? '#f59e0b' : '#06b6d4'}
                strokeWidth="1"
              />
              <text
                x={box.x + box.w - 42}
                y={box.y + 25}
                textAnchor="middle"
                fill={ch.outOfRange ? (isDark ? '#fde68a' : '#92400e') : isDark ? '#cffafe' : '#155e75'}
                fontSize="11"
                fontWeight="700"
                fontFamily="monospace"
              >
                {ch.currentTempC.toFixed(1)}°C
              </text>

              {/* Straw-lined wooden shelf */}
              <rect x={box.x + 10} y={shelfY} width={box.w - 20} height="7" rx="2" fill={straw} opacity="0.65" />

              {/* Ice blocks for each lot: height = remaining life % */}
              {visibleLots.map((ev, li) => {
                const bx = box.x + 16 + li * slotW;
                const bh = Math.max(10, Math.round((ev.remainingPct / 100) * maxBlockH));
                const by = shelfY - bh;
                const isMelted = ev.consumedPct >= 45 || ev.forcedDiscard;
                const isFocusedLot = focusedLotId === ev.lot.id;
                const fefoRank = fefoRankMap.get(ev.lot.id);

                let blockColor = isDark ? '#22d3ee' : '#0891b2';
                if (lens === 'category') {
                  const cf = CATEGORY_FILL[ev.lot.category];
                  blockColor = cf ? (isDark ? cf.dark : cf.light) : blockColor;
                } else if (lens === 'excursion') {
                  blockColor = ev.forcedDiscard ? '#ef4444' : ev.excursionCount > 0 ? '#f59e0b' : blockColor;
                } else if (lens === 'mkt') {
                  blockColor = ev.mktC > ch.room.maxC ? '#f59e0b' : blockColor;
                } else if (ev.forcedDiscard || ev.lot.status === 'quarantine') {
                  blockColor = '#f59e0b';
                }

                return (
                  <g
                    key={ev.lot.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLot(ev.lot.id);
                    }}
                    data-testid={`ice-block-${ev.lot.code}`}
                    data-remaining-pct={Math.round(ev.remainingPct)}
                    data-block-height={bh}
                  >
                    {/* Ice block body (rounded top when melting) */}
                    <rect
                      x={bx}
                      y={by}
                      width={blockW}
                      height={bh}
                      rx={isMelted ? 8 : 2}
                      fill={blockColor}
                      fillOpacity={isFocusedLot ? 0.95 : 0.72}
                      stroke={isFocusedLot ? textMain : isDark ? '#cffafe' : '#0e7490'}
                      strokeWidth={isFocusedLot ? 2 : 1}
                    />
                    {/* Glint highlight */}
                    <line
                      x1={bx + 4}
                      y1={by + 5}
                      x2={bx + 4}
                      y2={by + bh - 5}
                      stroke="#ffffff"
                      strokeOpacity="0.38"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    {/* Meltwater puddle under heat-exposed blocks */}
                    {isMelted && (
                      <ellipse
                        cx={bx + blockW / 2}
                        cy={shelfY + 11}
                        rx={blockW * 0.48}
                        ry="2.5"
                        fill={isDark ? '#38bdf8' : '#0284c7'}
                        opacity="0.55"
                      />
                    )}
                    {/* Lens overlay label */}
                    {lens === 'fefo' && fefoRank !== undefined && (
                      <text
                        x={bx + blockW / 2}
                        y={by - 4}
                        textAnchor="middle"
                        fill={textMain}
                        fontSize="9"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        #{fefoRank}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* 7-day Time Rail (scrub back to watch the compressor trip 3 days ago) */}
      <div
        className="absolute bottom-16 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-surface/90 px-3 py-1.5 shadow-sm backdrop-blur-md"
        data-testid="time-rail"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">7d rail</span>
        <input
          type="range"
          min={0}
          max={168}
          step={2}
          value={168 - scrubHoursAgo}
          aria-label="7-day temperature replay rail"
          data-testid="time-rail-slider"
          onChange={(e) => onScrubChange(168 - Number(e.target.value))}
          className="h-1.5 w-36 accent-accent-9 sm:w-52"
        />
        <span className="w-16 text-right font-mono text-xs text-fg">{scrubLabel}</span>
      </div>
    </div>
  );
}
