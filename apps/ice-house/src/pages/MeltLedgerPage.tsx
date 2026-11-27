import { useCallback } from 'react';

import { useAsync } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';
import { Badge, DataState, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@x10/shared/ui';

import { loadIceHouse } from '../domain/operations';
import type { Schema } from '../model';

export function MeltLedgerPage() {
  const { store } = useApp<Schema>();
  const loader = useCallback(() => loadIceHouse(store), [store]);
  const state = useAsync(loader, [loader]);
  const data = state.data;

  const lotMap = new Map((data?.lots ?? []).map((l) => [l.id, l]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Melt ledger" subtitle="QA disposition audit trail — releases, quarantines, and discards with evidence" />

      <DataState
        state={state}
        isEmpty={() => (data?.assessments.length ?? 0) === 0}
        empty={<EmptyState title="No assessments yet">QA decisions recorded on the Thaw table appear here.</EmptyState>}
      >
        {() => (
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>Timestamp</Th>
                  <Th>Lot</Th>
                  <Th>Decision</Th>
                  <Th numeric>MKT</Th>
                  <Th numeric>Consumed</Th>
                  <Th numeric>Hours &gt;5°C</Th>
                  <Th>Reason</Th>
                </Tr>
              </thead>
              <tbody>
                {(data?.assessments ?? [])
                  .slice()
                  .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                  .map((a) => {
                    const lot = lotMap.get(a.lotId);
                    return (
                      <Tr key={a.id}>
                        <Td className="font-mono text-xs">{a.at.slice(0, 16).replace('T', ' ')}</Td>
                        <Td className="font-mono text-xs font-medium">{lot?.code ?? a.lotId}</Td>
                        <Td>
                          <Badge tone={a.decision === 'discard' ? 'bad' : a.decision === 'quarantine' ? 'warn' : 'ok'}>
                            {a.decision}
                          </Badge>
                        </Td>
                        <Td numeric>{a.mktC.toFixed(1)}°C</Td>
                        <Td numeric>{a.consumedPct.toFixed(0)}%</Td>
                        <Td numeric>{a.hoursAbove5.toFixed(1)}h</Td>
                        <Td className="text-xs text-muted">{a.reason}</Td>
                      </Tr>
                    );
                  })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </DataState>
    </div>
  );
}
