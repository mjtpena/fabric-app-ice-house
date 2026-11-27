import { useCallback, useState } from 'react';

import { useAsync } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';
import {
  Badge,
  Button,
  DataState,
  Field,
  InlineError,
  Input,
  PageHeader,
  Section,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import { loadIceHouse, recordReading } from '../domain/operations';
import type { Schema } from '../model';

export function DoorLogPage() {
  const { store, me } = useApp<Schema>();
  const loader = useCallback(() => loadIceHouse(store), [store]);
  const state = useAsync(loader, [loader]);
  const data = state.data;

  const [roomId, setRoomId] = useState('');
  const [tempC, setTempC] = useState('3.2');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedRoomId = roomId || data?.rooms[0]?.id || '';

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setNotice(null);
    try {
      await recordReading(store, me, selectedRoomId, Number(tempC), 'manual');
      setNotice(`Logged ${Number(tempC).toFixed(1)}°C reading.`);
      state.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const roomMap = new Map((data?.rooms ?? []).map((r) => [r.id, r]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Door log" subtitle="Log manual chamber temperature checks or inspect recent logger readings" />
      <InlineError error={actionError} />
      {notice && (
        <div className="rounded-lg border border-accent-6 bg-accent-2 px-3 py-2 text-sm text-accent-11">
          {notice}
        </div>
      )}

      <DataState state={state}>
        {() => (
          <div className="space-y-6">
            <Section title="Log manual reading">
              <form onSubmit={handleLog} className="flex flex-wrap items-end gap-3">
                <Field label="Chamber" htmlFor="door-room">
                  <Select id="door-room" value={selectedRoomId} onChange={(e) => setRoomId(e.target.value)}>
                    {(data?.rooms ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.minC}°C..{r.maxC}°C)
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Temperature (°C)" htmlFor="door-temp">
                  <Input
                    id="door-temp"
                    type="number"
                    step="0.1"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                    required
                  />
                </Field>
                <Button type="submit" variant="primary">
                  Record reading
                </Button>
              </form>
            </Section>

            <Section title="Recent readings">
              <TableWrap>
                <Table>
                  <thead>
                    <Tr>
                      <Th>Timestamp</Th>
                      <Th>Chamber</Th>
                      <Th numeric>Temp (°C)</Th>
                      <Th>Source</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {(data?.readings ?? [])
                      .slice()
                      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                      .slice(0, 20)
                      .map((r) => {
                        const room = roomMap.get(r.roomId);
                        const out = room ? r.tempC > room.maxC || r.tempC < room.minC : false;
                        return (
                          <Tr key={r.id}>
                            <Td className="font-mono text-xs">{r.at.slice(0, 16).replace('T', ' ')}</Td>
                            <Td>{room?.name ?? r.roomId}</Td>
                            <Td numeric>
                              <Badge tone={out ? 'warn' : 'ok'}>{r.tempC.toFixed(1)}°C</Badge>
                            </Td>
                            <Td className="text-xs text-muted">{r.source}</Td>
                          </Tr>
                        );
                      })}
                  </tbody>
                </Table>
              </TableWrap>
            </Section>
          </div>
        )}
      </DataState>
    </div>
  );
}
