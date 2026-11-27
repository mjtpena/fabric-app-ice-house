import type { DemoScript } from '@x10/shared/demo';

export const script: DemoScript = {
  title: 'Ice House: cold-chain excursions, MKT and effective shelf life',
  persona: 'demo-admin',
  scenes: [
    {
      id: 'hook',
      say: [
        'When a compressor trips overnight, guessing between binning a cold room and shipping it costs either product or safety.',
        'Ice House draws five stone cold-store chambers where every lot is a block of ice as tall as its remaining shelf life.',
      ],
      async run(h) {
        await h.goto('/', 'demo-admin');
        await h.pause(2000);
      },
    },
    {
      id: 'time-rail',
      say: [
        'Scrubbing the seven-day rail back three days shows the compressor trip warming the North Dairy Vault in real time.',
      ],
      async run(h) {
        await h.page.getByTestId('time-rail-slider').fill('96');
        await h.pause(1800);
        await h.page.getByTestId('time-rail-slider').fill('168');
        await h.pause(1000);
      },
    },
    {
      id: 'lenses',
      say: [
        'Switching to the FEFO lens numbers every block by effective expiry rather than the printed date on the box.',
      ],
      async run(h) {
        await h.click(h.page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /FEFO/ }));
        await h.pause(1600);
      },
    },
    {
      id: 'today-focus',
      say: [
        'The Today panel surfaces lots awaiting QA, rooms out of range, and FEFO conflicts.',
      ],
      async run(h) {
        await h.click(h.page.getByRole('button', { name: /lots awaiting QA/ }).first());
        await h.pause(1500);
      },
    },
    {
      id: 'thaw-table',
      say: [
        'On the Thaw table, QA sees the exact Mean Kinetic Temperature, consumed life, and hours above five degrees.',
        'Lots past four hours above five degrees are forced to discard, while safe lots can be released with an audit record.',
      ],
      async run(h) {
        await h.goto('/thaw', 'demo-admin');
        await h.pause(1400);
        await h.click(h.page.getByRole('button', { name: 'Release' }).first());
        await h.pause(1600);
      },
    },
    {
      id: 'outro',
      say: [
        'Every reading logged, every excursion scored, and every pick ordered by real remaining life.',
      ],
      async run(h) {
        await h.goto('/fefo', 'demo-admin');
        await h.pause(1800);
      },
    },
  ],
};
