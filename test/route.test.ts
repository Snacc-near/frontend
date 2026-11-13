import { describe, it, expect } from "vitest";
import { selectRoute } from "../src/route.ts";

describe("selectRoute", () => {
  it("serves the landing page at the root", () => {
    expect(selectRoute("/")).toBe("landing");
    expect(selectRoute("")).toBe("landing");
  });

  it("serves the game at /app and below it", () => {
    expect(selectRoute("/app")).toBe("app");
    expect(selectRoute("/app/")).toBe("app");
    expect(selectRoute("/app/strain/1")).toBe("app");
  });

  it("does not treat look-alike prefixes as the game", () => {
    expect(selectRoute("/application")).toBe("landing");
    expect(selectRoute("/apps")).toBe("landing");
    expect(selectRoute("/story/app")).toBe("landing");
  });

  it("serves the Privy signing popup at /sign only", () => {
    expect(selectRoute("/sign")).toBe("sign");
    expect(selectRoute("/sign/")).toBe("sign");
    expect(selectRoute("/signup")).toBe("landing");
    expect(selectRoute("/sign/x")).toBe("landing");
  });

  it("falls back to the landing page for unknown paths", () => {
    expect(selectRoute("/nope")).toBe("landing");
  });
});
