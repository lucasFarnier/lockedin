import { describe, expect, it } from "vitest";
import { commonGroundScore, findCommonGround } from "./common-ground";

const pos = (company: string, start: string, end: string | null) => ({ title: "X", company, start, end, description: null });
const noGoals = { target_companies: [], target_roles: [] };

describe("findCommonGround", () => {
  it("flags same employer at overlapping dates as strong", () => {
    const ev = findCommonGround({ positions: [pos("Shopify Inc.", "2020-01", "2022-06")] }, { positions: [pos("Shopify", "2021-03", "Present")] }, noGoals);
    expect(ev[0]).toMatchObject({ category: "overlap", strength: "strong" });
  });
  it("flags same employer at different times as medium", () => {
    const ev = findCommonGround({ positions: [pos("RBC", "2010-01", "2012-01")] }, { positions: [pos("RBC", "2018-01", "Present")] }, noGoals);
    expect(ev[0]).toMatchObject({ category: "employer", strength: "medium" });
  });
  it("finds nothing for unrelated profiles", () => {
    expect(findCommonGround({ positions: [pos("A", "2020", "2021")], location: "Toronto" }, { positions: [pos("B", "2020", "2021")], location: "Paris" }, noGoals)).toEqual([]);
  });
  it("flags their company being one of my target companies", () => {
    const ev = findCommonGround({}, { current_company: "Acme" }, { target_companies: ["acme"], target_roles: [] });
    expect(ev[0]?.category).toBe("target_company");
  });
  it("matches skills that differ in wording", () => {
    const ev = findCommonGround({ skills: ["Python"] }, { skills: ["Python Programming"] }, noGoals);
    expect(ev[0]?.category).toBe("skills");
  });
  it("caps the score at 100", () => {
    expect(commonGroundScore([1, 2, 3, 4].map((i) => ({ id: String(i), category: "overlap", strength: "strong", evidence: "" })))).toBe(100);
  });
});
