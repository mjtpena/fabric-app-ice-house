import { useCallback, useMemo, useState } from 'react';

import { SimpleLineChart } from '@x10/shared/charts';
import { useAsync } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';
import {
  Badge,
  DataState,
  FilterSelect,
  PageHeader,
  Section,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Toolbar,
  Tr,
} from '@x10/shared/ui';

import { loadIceHouse } from '../domain/operations';
import { computeArithmeticMean, computeMKT, detectExcursions } from '../domain/thermal';
import type { Schema } from '../model';

export function ThermometerPage() {
  const { store } = useApp<Schema>();
  const loader = useCallback(() => loadIceHouse(store), [store]);
  const state = useAsync(loader, [loader]);
  const data = state.data;

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const room = data?.rooms.find((r) => r.id === selectedRoomId) ?? data?.rooms[0] ?? null;

  const { roomReadings, mkt, mean, excursions, chartData } = useMemo(() => {
    if (!data || !room) return { roomReadings: [], mkt: 0, mean: 0, excursions: [], chartData: [] };
    const rds = data.readings
      .filter((r) => r.roomId === room.id)
      .slice()
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return {
      roomReadings: rds,
      mkt: computeMKT(rds),
      mean: computeArithmeticMean(rds),
      excursions: detectExcursions(rds, room.minC, room.maxC),
      chartData: rds.map((r) => ({
        time: r.at.slice(5, 16).replace('T', ' '),
        tempC: r.tempC,
      })),
    };
  }, [data, room]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Thermometer" subtitle="7-day chamber trace, detected excursions, and Mean Kinetic Temperature" />

      <DataState state={state} isEmpty={() => !room}>
        {() =>
          room ? (
            <div className="space-y-6">
              <Toolbar>
                <FilterSelect
                  label="Chamber"
                  value={room.id}
                  onChange={setSelectedRoomId}
                  options={(data?.rooms ?? []).map((r) => ({ value: r.id, label: r.name }))}
                />
              </Toolbar>

              <StatStrip>
                <Stat label="Setpoint" value={`${room.setpointC.toFixed(1)}°C`} />
                <Stat label="7-day MKT" value={`${mkt.toFixed(2)}°C`} tone={mkt > room.maxC ? 'bad' : 'ok'} />
                <Stat label="Arithmetic mean" value={`${mean.toFixed(2)}°C`} />
                <Stat
                  label="Excursions (>10m)"
                  value={String(excursions.length)}
                  tone={excursions.length > 0 ? 'warn' : 'ok'}
                />
              </StatStrip>

              <Section title={`Temperature trace (${roomReadings.length} readings)`}>
                <SimpleLineChart
                  title={`${room.name} trace`}
                  summary={`Range ${room.minC}°C to ${room.maxC}°C`}
                  data={chartData}
                  xKey="time"
                  series={[{ key: 'tempC', label: 'Temp (°C)' }]}
                  height={240}
                />
              </Section>

              <Section title="Detected excursions">
                {excursions.length === 0 ? (
                  <p className="text-sm text-muted">No excursions exceeding the 10-minute grace window.</p>
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>Start</Th>
                          <Th>End</Th>
                          <Th numeric>Duration</Th>
                          <Th numeric>Peak temp</Th>
                          <Th>Severity</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {excursions.map((ex, i) => (
                          <Tr key={i}>
                            <Td className="font-mono text-xs">{ex.startAt.slice(0, 16).replace('T', ' ')}</Td>
                            <Td className="font-mono text-xs">{ex.endAt.slice(0, 16).replace('T', ' ')}</Td>
                            <Td numeric>{ex.durationMin} min</Td>
                            <Td numeric>{ex.peakTempC.toFixed(1)}°C</Td>
                            <Td>
                              <Badge tone={ex.severity === 'critical' ? 'bad' : ex.severity === 'major' ? 'warn' : 'info'}>
                                {ex.severity}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Section>
            </div>
          ) : null
        }
      </DataState>
    </div>
  );
}
