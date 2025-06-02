import config from "@/config/config";

describe("Config", () => {
  test("has correct default values", () => {
    expect(config).toBeDefined();
    expect(typeof config.apiUrl).toBe("string");
    expect(typeof config.maxFileSizeMB).toBe("number");
  });

  test("apiUrl is a valid URL format", () => {
    expect(config.apiUrl).toMatch(/^https?:\/\/.+/);
  });

  test("maxFileSizeMB is a positive number", () => {
    expect(config.maxFileSizeMB).toBeGreaterThan(0);
  });
});
