import { describe, expect, it } from "vitest";
import { validateSameOrigin } from "../csrf";

describe("validateSameOrigin", () => {
  it("allows same-origin application/json requests", () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json; charset=utf-8",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(validateSameOrigin(req, { requireJson: true })).toBeNull();
  });

  it("rejects cross-origin requests with 403", () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
      },
    });
    const res = validateSameOrigin(req, { requireJson: true });
    expect(res?.status).toBe(403);
  });

  it("rejects cross-site Sec-Fetch-Site requests with 403", () => {
    const req = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
      },
    });
    const res = validateSameOrigin(req);
    expect(res?.status).toBe(403);
  });

  it("rejects non-JSON form submissions with 415 when requireJson is true", () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    const res = validateSameOrigin(req, { requireJson: true });
    expect(res?.status).toBe(415);
  });
});
