import { describe, expect, it } from "vitest";
import { completeness, normalizeLinkedInUrl } from "./normalized";

describe("normalizeLinkedInUrl", () => {
  it("strips tracking params and trailing slash", () => {
    expect(normalizeLinkedInUrl("https://ca.linkedin.com/in/Jane-Doe-123/?utm_source=share&trk=x")).toBe("https://www.linkedin.com/in/jane-doe-123");
  });
  it("accepts bare domain", () => {
    expect(normalizeLinkedInUrl("linkedin.com/in/janedoe")).toBe("https://www.linkedin.com/in/janedoe");
  });
  it("rejects non-profile and non-linkedin urls", () => {
    expect(normalizeLinkedInUrl("https://linkedin.com/company/acme")).toBeNull();
    expect(normalizeLinkedInUrl("https://evil.com/in/janedoe")).toBeNull();
  });
});

describe("completeness", () => {
  it("is thin when there are no experience entries", () => {
    expect(completeness({ positions: [], education: [{ school: "U", degree: null, field: null, start: null, end: null }], skills: ["SQL"] }).thin).toBe(true);
  });
});
