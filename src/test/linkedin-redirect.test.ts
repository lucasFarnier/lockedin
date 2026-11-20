import { afterEach, describe, expect, it, vi } from "vitest";
import { backToAuth, callbackUrl, linkedInSignInOrigin } from "@/lib/linkedin-oauth.server";

afterEach(() => vi.unstubAllEnvs());

describe("LinkedIn redirect destination", () => {
  it("uses the configured HTTPS origin for its registered callback", () => {
    vi.stubEnv("LINKEDIN_SIGN_IN_ORIGIN", "https://lockedin.example");
    const origin = linkedInSignInOrigin();
    expect(origin).toBe("https://lockedin.example");
    expect(callbackUrl(origin!)).toBe("https://lockedin.example/api/public/linkedin/callback");
  });

  it.each(["http://lockedin.example", "https://lockedin.example/extra", "not a URL", ""])(
    "rejects a missing or invalid origin (%s)",
    (origin) => expect(linkedInSignInOrigin(origin)).toBeNull(),
  );

  it("returns a setup error on the current site when there is no origin", () => {
    const response = backToAuth(null, { error: "Please try again" });
    expect(response.headers.get("Location")).toBe("/auth?error_description=Please+try+again");
  });

  it("returns the one-time token in the fragment, not the request URL", () => {
    const response = backToAuth("https://lockedin.example", { token: "demo+token" });
    const destination = new URL(response.headers.get("Location")!);
    expect(destination.pathname).toBe("/auth");
    expect(destination.search).toBe("");
    expect(new URLSearchParams(destination.hash.slice(1)).get("li_token")).toBe("demo+token");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
