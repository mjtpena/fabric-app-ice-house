import { date, decimal, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.decidedBy) })
export class Assessment {
  @uuid()
  id!: string;

  @uuid()
  lotId!: string;

  @date()
  at!: Date;

  @decimal()
  mktC!: number;

  @decimal()
  consumedPct!: number;

  @decimal()
  hoursAbove5!: number;

  @set('release', 'quarantine', 'discard')
  decision!: 'release' | 'quarantine' | 'discard';

  @text({ min: 1, max: 120 })
  decidedBy!: string;

  @text({ min: 3, max: 400 })
  reason!: string;
}
