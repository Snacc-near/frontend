import { describe, it, expect } from "vitest";
import { selectRoute } from "../src/route.ts";

describe("selectRoute", () => {
  it("serves the landing page at the root", () => {
    expect(selectRoute("/")).toBe("landing");
    expect(selectRoute("")).toBe("landing");
    expect(selectRoute("/index.html")).toBe("landing");
  });

  it("serves the game at /app and below it", () => {
    expect(selectRoute("/app")).toBe("app");
    expect(selectRoute("/app/")).toBe("app");
    expect(selectRoute("/app/strain/1")).toBe("app");
  });

  it("does not treat look-alike prefixes as the game", () => {
    expect(selectRoute("/application")).toBe("notfound");
    expect(selectRoute("/apps")).toBe("notfound");
    expect(selectRoute("/story/app")).toBe("notfound");
  });

  it("serves the Privy signing popup at /sign only", () => {
    expect(selectRoute("/sign")).toBe("sign");
    expect(selectRoute("/sign/")).toBe("sign");
    expect(selectRoute("/signup")).toBe("notfound");
    expect(selectRoute("/sign/x")).toBe("notfound");
  });

  it("serves the legal pages at /terms and /privacy only", () => {
    expect(selectRoute("/terms")).toBe("terms");
    expect(selectRoute("/terms/")).toBe("terms");
    expect(selectRoute("/privacy")).toBe("privacy");
    expect(selectRoute("/privacy/")).toBe("privacy");
    expect(selectRoute("/terms/extra")).toBe("notfound");
    expect(selectRoute("/privacy-policy")).toBe("notfound");
    expect(selectRoute("/Terms")).toBe("notfound");
  });

  it("gives every unknown path the 404 page", () => {
    expect(selectRoute("/nope")).toBe("notfound");
    expect(selectRoute("/docs")).toBe("notfound");
    expect(selectRoute("/a/b/c")).toBe("notfound");
  });
});
