import { date, decimal, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.recordedBy) })
export class Reading {
  @uuid()
  id!: string;

  @uuid()
  roomId!: string;

  @date()
  at!: Date;

  @decimal()
  tempC!: number;

  @set('logger', 'manual')
  source!: 'logger' | 'manual';

  @text({ min: 1, max: 120 })
  recordedBy!: string;
}
