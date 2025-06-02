describe("Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("uses default values when environment variables are not set", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB;

    const config = require("@/config/config").default;

    expect(config.apiUrl).toBe("http://localhost:8000");
    expect(config.maxFileSizeMB).toBe(10);
  });

  test("uses environment variables when set", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB = "25";

    const config = require("@/config/config").default;

    expect(config.apiUrl).toBe("https://api.example.com");
    expect(config.maxFileSizeMB).toBe(25);
  });

  test("handles invalid file size environment variable", () => {
    process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB = "invalid";

    const config = require("@/config/config").default;

    // parseInt of 'invalid' returns NaN, which should be handled
    expect(config.maxFileSizeMB).toBeNaN();
  });

  test("handles empty string environment variables", () => {
    process.env.NEXT_PUBLIC_API_URL = "";
    process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB = "";

    const config = require("@/config/config").default;

    expect(config.apiUrl).toBe("http://localhost:8000");
    expect(config.maxFileSizeMB).toBe(10);
  });
});
