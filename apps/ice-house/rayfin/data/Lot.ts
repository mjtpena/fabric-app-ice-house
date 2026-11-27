import { date, decimal, entity, int, role, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create')
@role('authenticated', 'update')
@role('authenticated', 'delete')
export class Lot {
  @uuid()
  id!: string;

  @text({ min: 2, max: 20 })
  code!: string;

  @text({ min: 2, max: 80 })
  product!: string;

  @set('dairy', 'meat', 'chocolate', 'bakery', 'pharma', 'produce')
  category!: 'dairy' | 'meat' | 'chocolate' | 'bakery' | 'pharma' | 'produce';

  @uuid()
  roomId!: string;

  @int()
  qty!: number;

  @date()
  receivedAt!: Date;

  @date()
  bestBefore!: Date;

  @int()
  shelfLifeDays!: number;

  @decimal()
  refTempC!: number;

  @decimal()
  q10!: number;

  @decimal()
  consumedPct!: number;

  @set('ok', 'watch', 'quarantine', 'released', 'discarded')
  status!: 'ok' | 'watch' | 'quarantine' | 'released' | 'discarded';
}
