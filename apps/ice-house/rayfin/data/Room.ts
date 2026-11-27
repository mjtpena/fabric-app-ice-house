import { decimal, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create')
@role('authenticated', 'update')
@role('authenticated', 'delete')
export class Room {
  @uuid()
  id!: string;

  @text({ min: 2, max: 40 })
  name!: string;

  @set('chilled', 'frozen', 'controlled-ambient')
  kind!: 'chilled' | 'frozen' | 'controlled-ambient';

  @decimal()
  setpointC!: number;

  @decimal()
  minC!: number;

  @decimal()
  maxC!: number;
}
