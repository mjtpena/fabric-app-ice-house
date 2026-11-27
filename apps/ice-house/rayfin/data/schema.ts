import { AppMarker } from './AppMarker.js';
import { Assessment } from './Assessment.js';
import { Lot } from './Lot.js';
import { Person } from './Person.js';
import { Reading } from './Reading.js';
import { Room } from './Room.js';

export type AppSchema = {
  Person: Person;
  AppMarker: AppMarker;
  Room: Room;
  Lot: Lot;
  Reading: Reading;
  Assessment: Assessment;
};

export const schema = [Person, AppMarker, Room, Lot, Reading, Assessment];
