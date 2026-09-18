import { describe, expect, it } from 'vitest';
import { propsNeededForDay } from './artDepartmentNeeds';

const props = [
  { id: 'geiger', name: 'Vintage Geiger-teller', assignedScenes: ['scene-10'] },
  { id: 'kart', name: 'Topografisk kart', assignedScenes: ['scene-5', 'scene-9'] },
  { id: 'flagg', name: 'Norsk flagg', assignedScenes: ['scene-7'] },
  { id: 'koffert', name: 'Feltkoffert' },
];

describe('propsNeededForDay', () => {
  it('utleder hva dagens scener krever', () => {
    const { needed } = propsNeededForDay(['scene-9', 'scene-10'], [], props);

    expect(needed.map((item) => item.id)).toEqual(['kart', 'geiger']);
  });

  it('skiller det som mangler fra det som allerede står på dagen', () => {
    const { missing, needed } = propsNeededForDay(['scene-9', 'scene-10'], ['geiger'], props);

    expect(needed.map((item) => item.onDay)).toEqual([false, true]);
    expect(missing.map((item) => item.id)).toEqual(['kart']);
  });

  it('sier hvilke av dagens scener som krever rekvisitten', () => {
    const { needed } = propsNeededForDay(['scene-9'], [], props);

    // Kartet hører til scene 5 og 9; bare scene 9 skytes denne dagen.
    expect(needed[0].sceneIds).toEqual(['scene-9']);
  });

  it('nevner rekvisitter på dagen som ingen av scenene krever', () => {
    const { extra } = propsNeededForDay(['scene-9'], ['flagg'], props);

    expect(extra.map((item) => item.id)).toEqual(['flagg']);
  });

  it('teller ikke en rekvisitt uten scener som overflødig når den ikke er på dagen', () => {
    const { needed, missing, extra } = propsNeededForDay(['scene-9'], [], props);

    expect([...needed, ...missing, ...extra].map((item) => item.id)).not.toContain('koffert');
  });

  it('svarer tomt for en dag uten scener, i stedet for å foreslå alt', () => {
    const { needed, missing } = propsNeededForDay([], [], props);

    expect(needed).toEqual([]);
    expect(missing).toEqual([]);
  });

  it('faller tilbake på id-en når rekvisitten mangler navn', () => {
    const { needed } = propsNeededForDay(['scene-1'], [], [{ id: 'ukjent', assignedScenes: ['scene-1'] }]);

    expect(needed[0].name).toBe('ukjent');
  });
});
