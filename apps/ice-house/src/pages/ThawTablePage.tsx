import { useCallback, useMemo, useState } from 'react';

import { useAsync } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';
import {
  Badge,
  Button,
  DataState,
  EmptyState,
  InlineError,
  PageHeader,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import { decideLotQa, loadIceHouse } from '../domain/operations';
import { evaluateLot } from '../domain/thermal';
import type { AssessmentDecision, Schema } from '../model';

export function ThawTablePage() {
  const { store, me } = useApp<Schema>();
  const loader = useCallback(() => loadIceHouse(store), [store]);
  const state = useAsync(loader, [loader]);
  const data = state.data;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const qaQueue = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
    return data.lots
      .filter((l) => l.status !== 'discarded')
      .map((l) =>
        evaluateLot(
          l,
          roomMap.get(l.roomId) ?? null,
          data.readings.filter((r) => r.roomId === l.roomId),
          now,
        ),
      )
      .filter((ev) => ev.needsQa || ev.forcedDiscard || ev.lot.status === 'quarantine' || ev.lot.status === 'watch');
  }, [data]);

  const handleDecision = async (lotId: string, code: string, decision: AssessmentDecision) => {
    setBusyId(lotId);
    setActionError(null);
    setNotice(null);
    try {
      const reason =
        decision === 'release'
          ? 'QA verified MKT and remaining shelf life within tolerance.'
          : decision === 'discard'
            ? 'QA discarded lot due to excursion / shelf-life limit.'
            : 'QA held lot in quarantine for secondary inspection.';
      await decideLotQa(store, me, lotId, decision, reason);
      setNotice(`Recorded QA ${decision} assessment for ${code}.`);
      state.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Thaw table"
        subtitle="QA excursion assessment with MKT, consumed shelf life, and mandatory food-safety rules"
      />
      <InlineError error={actionError} />
      {notice && (
        <div className="rounded-lg border border-accent-6 bg-accent-2 px-3 py-2 text-sm text-accent-11">
          {notice}
        </div>
      )}

      <DataState
        state={state}
        isEmpty={() => qaQueue.length === 0}
        empty={<EmptyState title="No lots awaiting QA">All active lots are within thermal tolerance.</EmptyState>}
      >
        {() => (
          <div className="space-y-6">
            <StatStrip>
              <Stat label="Awaiting QA" value={String(qaQueue.length)} tone="warn" />
              <Stat
                label="Forced discard"
                value={String(qaQueue.filter((q) => q.forcedDiscard).length)}
                tone="bad"
              />
              <Stat label="QA assessments" value={String(data?.assessments.length ?? 0)} />
            </StatStrip>

            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>Lot</Th>
                    <Th>Product</Th>
                    <Th numeric>MKT</Th>
                    <Th numeric>Consumed</Th>
                    <Th numeric>Hours &gt;5°C</Th>
                    <Th>Rule status</Th>
                    <Th>QA decision</Th>
                  </Tr>
                </thead>
                <tbody>
                  {qaQueue.map((ev) => (
                    <Tr key={ev.lot.id} data-testid={`qa-row-${ev.lot.code}`}>
                      <Td className="font-mono text-xs font-medium">{ev.lot.code}</Td>
                      <Td>{ev.lot.product}</Td>
                      <Td numeric>{ev.mktC.toFixed(1)}°C</Td>
                      <Td numeric>{ev.consumedPct.toFixed(0)}%</Td>
                      <Td numeric>{ev.hoursAbove5.toFixed(1)}h</Td>
                      <Td>
                        {ev.forcedDiscard ? (
                          <Badge tone="bad">Forced discard</Badge>
                        ) : (
                          <Badge tone="warn">{ev.lot.status}</Badge>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busyId === ev.lot.id || !me.isAdmin || ev.forcedDiscard}
                            onClick={() => handleDecision(ev.lot.id, ev.lot.code, 'release')}
                          >
                            Release
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busyId === ev.lot.id || !me.isAdmin}
                            onClick={() => handleDecision(ev.lot.id, ev.lot.code, 'discard')}
                          >
                            Discard
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        )}
      </DataState>
    </div>
  );
}
