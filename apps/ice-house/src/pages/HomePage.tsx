import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAsync, usePolling } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';
import {
  Badge,
  DataState,
  Legend,
  LensBar,
  StagePage,
  Table,
  TableWrap,
  Td,
  Th,
  TodayPanel,
  Tr,
  ViewAsSwitch,
  ViewToggle,
  useHotkeys,
  type TodayItem,
} from '@x10/shared/ui';

import { IceHouseStage, type IceHouseLens, type RoomSnapshot } from '../components/IceHouseStage';
import { CONFIG } from '../domain/config';
import { loadIceHouse } from '../domain/operations';
import { computeMKT, detectExcursions, evaluateLot, fefoOrder } from '../domain/thermal';
import type { Schema } from '../model';

const LENSES: { value: IceHouseLens; label: string }[] = [
  { value: 'life', label: 'Life remaining' },
  { value: 'mkt', label: 'MKT' },
  { value: 'fefo', label: 'FEFO order' },
  { value: 'category', label: 'Category' },
  { value: 'excursion', label: 'Excursion' },
];

const VIEW_AS_OPTIONS = [
  { value: 'qa', label: 'QA lead' },
  { value: 'operator', label: 'Cold-store operator' },
];

export function HomePage() {
  const { store, me } = useApp<Schema>();
  const [view, setView] = useState<'stage' | 'list'>('stage');
  const [lens, setLens] = useState<IceHouseLens>('life');
  const [viewAs, setViewAs] = useState<string>(me.isAdmin ? 'qa' : 'operator');
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);
  const [focusedLotId, setFocusedLotId] = useState<string | null>(null);
  const [scrubHoursAgo, setScrubHoursAgo] = useState<number>(0);

  const loader = useCallback(() => loadIceHouse(store), [store]);
  const state = useAsync(loader, [loader]);
  usePolling(state.reload, 5000);
  const data = state.data;

  const referenceNow = useMemo(() => {
    if (!data || data.readings.length === 0) return new Date();
    const maxAt = Math.max(...data.readings.map((r) => Date.parse(r.at)));
    return new Date(maxAt - scrubHoursAgo * 3_600_000);
  }, [data, scrubHoursAgo]);

  const { chambers, allEvals, fefoRankMap } = useMemo(() => {
    if (!data) return { chambers: [] as RoomSnapshot[], allEvals: [], fefoRankMap: new Map<string, number>() };
    const cutoffMs = referenceNow.getTime();
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

    const filteredReadingsByRoom = new Map<string, typeof data.readings>();
    for (const r of data.readings) {
      if (Date.parse(r.at) > cutoffMs) continue;
      const arr = filteredReadingsByRoom.get(r.roomId) ?? [];
      arr.push(r);
      filteredReadingsByRoom.set(r.roomId, arr);
    }

    const evals = data.lots.map((lot) => {
      const room = roomMap.get(lot.roomId) ?? null;
      const rds = filteredReadingsByRoom.get(lot.roomId) ?? [];
      return evaluateLot(lot, room, rds, referenceNow);
    });

    const ordered = fefoOrder(evals);
    const rankMap = new Map<string, number>();
    ordered.forEach((ev, idx) => rankMap.set(ev.lot.id, idx + 1));

    const snaps: RoomSnapshot[] = data.rooms.map((room) => {
      const rds = (filteredReadingsByRoom.get(room.id) ?? []).slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const latest = rds[rds.length - 1];
      const currentTempC = latest ? latest.tempC : room.setpointC;
      const mktC = rds.length > 0 ? computeMKT(rds) : room.setpointC;
      const outOfRange = currentTempC > room.maxC || currentTempC < room.minC;
      const excursions = detectExcursions(rds, room.minC, room.maxC);
      return {
        room,
        currentTempC,
        mktC,
        outOfRange,
        excursionCount: excursions.length,
        lots: evals.filter((e) => e.lot.roomId === room.id),
      };
    });

    return { chambers: snaps, allEvals: evals, fefoRankMap: rankMap };
  }, [data, referenceNow]);

  useHotkeys({
    escape: () => {
      setFocusedRoomId(null);
      setFocusedLotId(null);
    },
  });

  const todayItems: TodayItem[] = useMemo(() => {
    const items: TodayItem[] = [];
    const awaitingQa = allEvals.filter((e) => e.lot.status === 'quarantine' || e.forcedDiscard);
    if (awaitingQa.length > 0) {
      items.push({
        id: `qa-${awaitingQa[0].lot.roomId}`,
        title: `${awaitingQa.length} lots awaiting QA decision`,
        meta: `${awaitingQa.filter((e) => e.forcedDiscard).length} forced discard · open Thaw table`,
        severity: 'bad',
        value: String(awaitingQa.length),
      });
    }

    const outRooms = chambers.filter((c) => c.outOfRange);
    if (outRooms.length > 0) {
      items.push({
        id: `room-${outRooms[0].room.id}`,
        title: `${outRooms[0].room.name} out of range`,
        meta: `${outRooms[0].currentTempC.toFixed(1)}°C (max ${outRooms[0].room.maxC}°C)`,
        severity: 'warn',
        value: `${outRooms[0].currentTempC.toFixed(1)}°`,
      });
    }

    const expiringSoon = allEvals.filter(
      (e) => e.lot.status !== 'discarded' && e.daysToEffectiveExpiry <= CONFIG.EXPIRY_ALERT_DAYS,
    );
    if (expiringSoon.length > 0) {
      items.push({
        id: `exp-${expiringSoon[0].lot.roomId}`,
        title: `${expiringSoon.length} lots expire within ${CONFIG.EXPIRY_ALERT_DAYS} days`,
        meta: `Earliest: ${expiringSoon[0].lot.code} (${expiringSoon[0].daysToEffectiveExpiry.toFixed(1)}d)`,
        severity: 'warn',
        value: String(expiringSoon.length),
      });
    }

    const fefoConflicts = allEvals.filter((e) => e.fefoConflict && e.lot.status !== 'discarded');
    if (fefoConflicts.length > 0) {
      items.push({
        id: `fefo-${fefoConflicts[0].lot.roomId}`,
        title: `${fefoConflicts.length} FEFO conflicts vs printed date`,
        meta: `Heat exposure shortened effective expiry`,
        severity: 'info',
        value: String(fefoConflicts.length),
      });
    }

    return items.slice(0, 5);
  }, [allEvals, chambers]);

  const handleTodaySelect = (item: TodayItem) => {
    const roomId = item.id.replace(/^(qa|room|exp|fefo)-/, '');
    setFocusedRoomId((prev) => (prev === roomId ? null : roomId));
    if (item.id.startsWith('fefo-')) setLens('fefo');
    else if (item.id.startsWith('qa-')) setLens('excursion');
  };

  const legendItems = [
    { label: 'Ice block height = remaining shelf life %', color: 'var(--accent-9)' },
    { label: 'Rounded top + puddle = heat-melted lot', color: '#38bdf8' },
    { label: 'Warm wall tint = excursion detected', color: '#f59e0b' },
    { label: 'Wall frost = colder setpoint', color: '#67e8f9' },
  ];

  return (
    <DataState state={state} isEmpty={() => chambers.length === 0}>
      {() => (
        <StagePage
          label="Ice House cold-chain cutaway stage"
          view={view}
          title="The Ice House"
          meta={`${chambers.length} chambers · ${allEvals.filter((e) => e.lot.status !== 'discarded').length} active lots · ${allEvals.filter((e) => e.lot.status === 'quarantine').length} in QA`}
          breadcrumb={[
            { label: 'Ice House', onClick: () => setFocusedRoomId(null) },
            ...(focusedRoomId
              ? [{ label: chambers.find((c) => c.room.id === focusedRoomId)?.room.name ?? 'Chamber' }]
              : []),
          ]}
          topRight={<ViewToggle value={view} onChange={setView} stageLabel="Ice House" glass={view === 'stage'} />}
          lenses={<LensBar lenses={LENSES} value={lens} onChange={(v) => setLens(v as IceHouseLens)} />}
          legend={<Legend title="Chamber key" items={legendItems} collapsible defaultOpen={false} />}
          bottomRight={<ViewAsSwitch options={VIEW_AS_OPTIONS} value={viewAs} onChange={setViewAs} />}
          side={
            <TodayPanel
              bare
              items={todayItems}
              activeId={focusedRoomId ? `qa-${focusedRoomId}` : undefined}
              onSelect={handleTodaySelect}
            />
          }
          sideCount={todayItems.length}
          stage={
            <IceHouseStage
              chambers={chambers}
              lens={lens}
              focusedRoomId={focusedRoomId}
              focusedLotId={focusedLotId}
              onSelectRoom={(rid) => setFocusedRoomId((prev) => (prev === rid ? null : rid))}
              onSelectLot={(lid) => setFocusedLotId((prev) => (prev === lid ? null : lid))}
              fefoRankMap={fefoRankMap}
              scrubHoursAgo={scrubHoursAgo}
              onScrubChange={setScrubHoursAgo}
            />
          }
          list={
            <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" data-testid="ice-house-list-view">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-fg">Cold-store lots ({allEvals.length})</h2>
                <Link to="/thaw" className="text-sm font-medium text-accent-11 hover:underline">
                  Open Thaw table →
                </Link>
              </div>
              <TableWrap>
                <Table>
                  <thead>
                    <Tr>
                      <Th>Lot</Th>
                      <Th>Product</Th>
                      <Th>Room</Th>
                      <Th numeric>Remaining life</Th>
                      <Th numeric>MKT</Th>
                      <Th numeric>Hours &gt;5°C</Th>
                      <Th>Status</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {allEvals.map((ev) => (
                      <Tr key={ev.lot.id} data-testid={`list-lot-${ev.lot.code}`}>
                        <Td className="font-mono text-xs font-medium">{ev.lot.code}</Td>
                        <Td>{ev.lot.product}</Td>
                        <Td className="text-xs text-muted">{ev.room?.name ?? '—'}</Td>
                        <Td numeric data-testid={`list-remaining-${ev.lot.code}`}>
                          {Math.round(ev.remainingPct)}%
                        </Td>
                        <Td numeric>{ev.mktC.toFixed(1)}°C</Td>
                        <Td numeric>{ev.hoursAbove5.toFixed(1)}h</Td>
                        <Td>
                          <Badge
                            tone={
                              ev.forcedDiscard || ev.lot.status === 'discarded'
                                ? 'bad'
                                : ev.lot.status === 'quarantine' || ev.lot.status === 'watch'
                                  ? 'warn'
                                  : 'ok'
                            }
                          >
                            {ev.forcedDiscard && ev.lot.status !== 'discarded' ? 'forced discard' : ev.lot.status}
                          </Badge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </div>
          }
        />
      )}
    </DataState>
  );
}
