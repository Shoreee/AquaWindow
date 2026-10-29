import { describe, expect, it } from "vitest";
import { selectionAt, SELECTION_CONTACT, SELECTION_DURATION, activationAt, approachAngle, extractionAt, HANDOFF_DURATION, deformationImpulse, perimeterPoint, nearestPerimeter } from "./energyMotion";

describe("continuous energy handoffs", () => {
  it("has no activation discontinuity at the 420ms gesture threshold", () => {
    expect(Math.abs(activationAt(420.1) - activationAt(419.9))).toBeLessThan(
      0.001,
    );
    expect(activationAt(0)).toBe(0);
    expect(activationAt(1400)).toBe(1);
  });
  it("draws energy from the core before a ribbon can arrive, then absorbs its full length", () => {
    expect(extractionAt(0.06).head).toBe(0);
    expect(extractionAt(0.12).drain).toBeGreaterThan(0);
    expect(extractionAt(0.75).head).toBeGreaterThan(0.4);
    expect(extractionAt(0.3).arrived).toBe(0);
    expect(extractionAt(HANDOFF_DURATION)).toMatchObject({
      head: 1,
      tail: 1,
      arrived: 1,
      drain: 0,
    });
    for (let t = 0; t < HANDOFF_DURATION; t += 0.003) {
      const state = extractionAt(t);
      expect(state.tail).toBeLessThanOrEqual(state.head);
      expect(state.head - state.tail).toBeGreaterThanOrEqual(0);
      if (state.arrived > 0) expect(state.head).toBe(1);
    }
  });
  it("keeps a selected ribbon in flight for a complete long orbit before entry",()=>{
    expect(SELECTION_CONTACT).toBe(1);
    for(let t=0;t<SELECTION_CONTACT;t+=.05){
      const packet=selectionAt(t);expect(packet.arrived).toBe(0);
      expect(packet.tail).toBeLessThanOrEqual(packet.head);
    }
    expect(selectionAt(.9).crawl).toBe(0);
    expect(selectionAt(1.5).crawl).toBeGreaterThan(.5);
    expect(selectionAt(.65).head-selectionAt(.65).tail).toBeGreaterThan(.15);
    expect(selectionAt(SELECTION_DURATION)).toMatchObject({head:1,tail:1,arrived:1,bound:1});
  });
  it("responds equally to the same host velocity at different refresh rates", () => {
    expect(deformationImpulse(5, 1 / 60)).toBeCloseTo(deformationImpulse(2.5, 1 / 120));
    expect(deformationImpulse(0, 1 / 60)).toBe(0);
    expect(deformationImpulse(1000, 0)).toBe(1.6);
  });
  it("travels one complete rounded contour before absorption, with a stable nearest entry", () => {
    expect(extractionAt(.42).crawl).toBe(0);
    expect(extractionAt(2.12).crawl).toBe(1);
    expect(extractionAt(1.62).tail).toBe(1);
    const entry = nearestPerimeter(600, 400, 760, 200);
    const point = perimeterPoint(600, 400, entry);
    expect(point.x).toBeCloseTo(600, 0);
    expect(point.y).toBeCloseTo(200, 0);
    for (const t of [0, .1, .4, .9]) {
      expect(perimeterPoint(600, 400, t).x).toBeCloseTo(perimeterPoint(600, 400, t + 1).x);
      expect(perimeterPoint(600, 400, t).y).toBeCloseTo(perimeterPoint(600, 400, t + 1).y);
    }
  });
  it("necks the donated material before its tail separates, and rewinds that sequence", () => {
    expect(extractionAt(.1).sever).toBe(0);
    expect(extractionAt(.32).sever).toBeGreaterThan(.6);
    expect(extractionAt(.15).tail).toBe(0);
    expect(extractionAt(.37).sever).toBe(1);
    expect(extractionAt(.40).tail).toBe(0);
    expect(extractionAt(.65).tail).toBeGreaterThan(0);
    expect(extractionAt(.81).tail).toBeLessThan(.5);
    expect(extractionAt(.81).head-extractionAt(.81).tail).toBeGreaterThan(.1);
    expect(extractionAt(1.21).tail).toBe(1);
  });
  it("moves an attachment across the parameter seam through the shortest arc", () => {
    const next = approachAngle(0.98, 0.02, 0.5);
    expect(next < 0.01 || next > 0.99).toBe(true);
  });
});
