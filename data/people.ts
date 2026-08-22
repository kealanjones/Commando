/**
 * Names that recur across the register. "Chase X for Y" is a large part of
 * the job, so who you are waiting on is extracted into a real dimension at
 * seed time rather than living inside the title string.
 *
 * Add a name here and re-seed to have it picked up everywhere it appears.
 */
export const KNOWN_PEOPLE: { name: string; role?: string; aliases?: string[] }[] = [
  { name: 'Anthony',  role: 'Director' },
  { name: 'Steph',    role: 'Executive Assistant' },
  { name: 'Dale' },
  { name: 'Derek' },
  { name: 'Emma' },
  { name: 'Suzanne' },
  { name: 'Isaac' },
  { name: 'Laura' },
  { name: 'Lauren' },
  { name: 'Belaal' },
  { name: 'Satya' },
  { name: 'Candy' },
  { name: 'Matty' },
  { name: 'Jeff' },
  { name: 'Rebecca' },
  { name: 'Ara' },
  { name: 'Kirsty',   role: 'Head of Charity' },
  { name: 'Peter' },
  { name: 'Matt Weis' },
  { name: 'Mark Taylor' },
  { name: 'John Richardson' },
  { name: 'Dr Koval' },
  { name: 'Beatrice' },
  { name: 'Marty' },
  { name: 'Gurch' },
  { name: 'Matt' },
];
