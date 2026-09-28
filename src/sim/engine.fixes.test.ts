import { describe, expect, it } from 'vitest';
import { RAMP, SECOND_RACK_HEAD_START_FAULT_LVL } from './constants';
import { act, advanceReading, createInitialState, failSecondRack, switchFocus, undo } from './engine';

describe('fixes ramp in gradually (docs/decisions.md)', () => {
  it("B-07's boost lands over several readings, not instantly", () => {
    let s = act(createInitialState(201)).state;
    expect(s.racks['B-07'].prog).toBe(0); // not yet landed the instant it's confirmed

    s = advanceReading(s).state;
    expect(s.racks['B-07'].prog).toBeCloseTo(RAMP['B-07'], 6);
    expect(s.racks['B-07'].prog).toBeLessThan(1);

    s = advanceReading(s).state;
    expect(s.racks['B-07'].prog).toBeCloseTo(RAMP['B-07'] * 2, 6);
  });

  it("B-07's boost caps at fully landed and holds there", () => {
    let s = act(createInitialState(202)).state;
    for (let i = 0; i < 20; i++) s = advanceReading(s).state;
    expect(s.racks['B-07'].prog).toBe(1);
  });

  it("A-03's cooling ramps in gradually", () => {
    let s = switchFocus(createInitialState(203), 'A-03');
    s = act(s).state;
    s = advanceReading(s).state;
    expect(s.racks['A-03'].prog).toBeCloseTo(RAMP['A-03'], 6);
    expect(s.racks['A-03'].prog).toBeLessThan(1);
  });

  it('a reverted fix decays back down over readings rather than resetting instantly', () => {
    let s = act(createInitialState(204)).state;
    for (let i = 0; i < 3; i++) s = advanceReading(s).state;
    const progBefore = s.racks['B-07'].prog;
    expect(progBefore).toBeGreaterThan(0);

    s = undo(s).state;
    expect(s.racks['B-07'].prog).toBe(progBefore); // undo itself doesn't touch prog

    s = advanceReading(s).state;
    expect(s.racks['B-07'].prog).toBeCloseTo(Math.max(0, progBefore - 0.34), 6);
    expect(s.racks['B-07'].prog).toBeGreaterThan(0); // still decaying, not snapped to 0
  });
});

describe('fan degradation is gradual (docs/decisions.md)', () => {
  it("A-03's fault ramps in over readings once triggered, not instantly", () => {
    let s = failSecondRack(createInitialState(205), { headStart: false }).state;
    expect(s.racks['A-03'].faultLvl).toBe(0);

    s = advanceReading(s).state;
    expect(s.racks['A-03'].faultLvl).toBeCloseTo(0.11, 6);
    expect(s.racks['A-03'].faultLvl).toBeLessThan(1);

    s = advanceReading(s).state;
    expect(s.racks['A-03'].faultLvl).toBeCloseTo(0.22, 6);
  });

  it('fault degradation caps at fully degraded and holds there', () => {
    let s = failSecondRack(createInitialState(206), { headStart: false }).state;
    for (let i = 0; i < 20; i++) s = advanceReading(s).state;
    expect(s.racks['A-03'].faultLvl).toBe(1);
  });

  it('the manual "fail a second rack" trigger gives the fault a head start (skips the first few readings)', () => {
    const s = failSecondRack(createInitialState(207)).state; // default headStart: true
    expect(s.racks['A-03'].faultLvl).toBe(SECOND_RACK_HEAD_START_FAULT_LVL);
  });

  it('the automatic aftershock trigger gives no head start', () => {
    const s = failSecondRack(createInitialState(208), {}).state;
    expect(s.racks['A-03'].faultLvl).toBe(0);
  });

  it('degradation continues even if the rack is not currently focused', () => {
    let s = failSecondRack(createInitialState(209), { headStart: false }).state; // focus stays B-07
    expect(s.focus).toBe('B-07');
    s = advanceReading(s).state;
    expect(s.racks['A-03'].faultLvl).toBeCloseTo(0.11, 6);
  });
});
