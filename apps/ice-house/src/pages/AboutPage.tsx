import { PageHeader, Section, Table, TableWrap, Td, Th, Tr } from '@x10/shared/ui';

import { CONFIG } from '../domain/config';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="About Ice House"
        subtitle="Cold-chain excursion tracking, Mean Kinetic Temperature (MKT), and effective shelf-life FEFO picking"
      />

      <Section title="What it solves">
        <p className="text-sm leading-relaxed text-fg">
          When a compressor trips overnight or a cold-room door is propped open during peak season, teams often guess
          whether to discard an entire room or ship it anyway. Ice House logs chamber readings, detects excursions past
          the door-open grace window, computes pharmacopoeial MKT and Q10 consumed shelf life for every lot, and gives QA
          the arithmetic to release, quarantine, or discard with an audit trail.
        </p>
      </Section>

      <Section title="Rules & thresholds (config.ts)">
        <TableWrap>
          <Table>
            <thead>
              <Tr>
                <Th>Rule</Th>
                <Th>Value / standard</Th>
              </Tr>
            </thead>
            <tbody>
              <Tr>
                <Td className="font-medium">Mean Kinetic Temperature (MKT)</Td>
                <Td className="font-mono text-xs">
                  ΔH/R = {CONFIG.DELTA_H_OVER_R.toLocaleString()} K (ΔH = 83.144 kJ/mol, pharmacopoeial convention)
                </Td>
              </Tr>
              <Tr>
                <Td className="font-medium">Excursion grace window</Td>
                <Td className="font-mono text-xs">GRACE_MIN = {CONFIG.GRACE_MIN} min (ignores brief door opens)</Td>
              </Tr>
              <Tr>
                <Td className="font-medium">Chilled TCS hard rule</Td>
                <Td className="font-mono text-xs">
                  &gt; {CONFIG.MAX_HOURS_ABOVE_5}h cumulative above {CONFIG.TCS_TEMP_C}°C forces discard
                </Td>
              </Tr>
              <Tr>
                <Td className="font-medium">Frozen thaw rule</Td>
                <Td className="font-mono text-xs">
                  Above {CONFIG.FROZEN_THAW_C}°C for ≥ {CONFIG.FROZEN_THAW_MIN} min may not be re-frozen
                </Td>
              </Tr>
              <Tr>
                <Td className="font-medium">Illustrative Q10 defaults</Td>
                <Td className="font-mono text-xs">
                  {Object.entries(CONFIG.Q10_BY_CATEGORY)
                    .map(([k, v]) => `${k} ${v.toFixed(1)}`)
                    .join(' · ')}
                </Td>
              </Tr>
            </tbody>
          </Table>
        </TableWrap>
      </Section>

      <Section title="Notice">
        <p className="text-sm text-muted">
          Ice House supports cold-chain quality assurance and FEFO picking workflows. Q10 factors are illustrative
          category defaults; this app is not legal, food-safety, or pharmacopoeial compliance advice.
        </p>
      </Section>
    </div>
  );
}
