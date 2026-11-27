import { useCallback, useMemo, useState } from 'react';

import { useAsync } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';
import {
  Badge,
  Button,
  DataState,
  InlineError,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import { loadIceHouse, pickFromLot } from '../domain/operations';
import { evaluateLot, fefoOrder } from '../domain/thermal';
import type { Schema } from '../model';

export function FefoPickPage() {
  const { store } = useApp<Schema>();
  const loader = useCallback(() => loadIceHouse(store), [store]);
  const state = useAsync(loader, [loader]);
  const data = state.data;

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pickList = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
    const evals = data.lots.map((l) =>
      evaluateLot(
        l,
        roomMap.get(l.roomId) ?? null,
        data.readings.filter((r) => r.roomId === l.roomId),
        now,
      ),
    );
    return fefoOrder(evals);
  }, [data]);

  const handlePick = async (lotId: string, code: string) => {
    setActionError(null);
    setNotice(null);
    try {
      await pickFromLot(store, lotId, 1);
      setNotice(`Picked 1 unit from ${code}.`);
      state.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="FEFO pick"
        subtitle="First-Expired, First-Out pick sequence by effective expiry (watch lots last until QA releases)"
      />
      <InlineError error={actionError} />
      {notice && (
        <div className="rounded-lg border border-accent-6 bg-accent-2 px-3 py-2 text-sm text-accent-11">
          {notice}
        </div>
      )}

      <DataState state={state} isEmpty={() => pickList.length === 0}>
        {() => (
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th numeric>Rank</Th>
                  <Th>Lot</Th>
                  <Th>Product</Th>
                  <Th>Effective expiry</Th>
                  <Th>Printed best-before</Th>
                  <Th numeric>Qty</Th>
                  <Th>Status</Th>
                  <Th>Pick</Th>
                </Tr>
              </thead>
              <tbody>
                {pickList.slice(0, 25).map((ev, idx) => (
                  <Tr key={ev.lot.id}>
                    <Td numeric className="font-semibold">
                      #{idx + 1}
                    </Td>
                    <Td className="font-mono text-xs">{ev.lot.code}</Td>
                    <Td>{ev.lot.product}</Td>
                    <Td className="font-mono text-xs">{ev.effectiveExpiry.slice(0, 10)}</Td>
                    <Td className="font-mono text-xs text-muted">{ev.lot.bestBefore.slice(0, 10)}</Td>
                    <Td numeric>{ev.lot.qty}</Td>
                    <Td>
                      <Badge tone={ev.lot.status === 'watch' ? 'warn' : ev.fefoConflict ? 'info' : 'ok'}>
                        {ev.lot.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Button size="sm" variant="secondary" onClick={() => handlePick(ev.lot.id, ev.lot.code)}>
                        Pick 1
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </DataState>
    </div>
  );
}
