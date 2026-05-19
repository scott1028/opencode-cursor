// tests/unit/utils/parse-jsonc.test.ts
import { describe, test, expect } from "bun:test";
import { parseJsonc } from "../../../src/utils/parse-jsonc.js";

describe("parseJsonc", () => {
  test("parses standard JSON", () => {
    const out = parseJsonc('{"a":1,"b":[1,2,3]}');
    expect(out).toEqual({ a: 1, b: [1, 2, 3] });
  });

  test("strips line comments", () => {
    const raw = `{
      // top-level comment
      "a": 1, // inline comment
      "b": 2
    }`;
    expect(parseJsonc(raw)).toEqual({ a: 1, b: 2 });
  });

  test("strips block comments", () => {
    const raw = `{
      /* block
         comment */
      "a": 1,
      "b": /* inline */ 2
    }`;
    expect(parseJsonc(raw)).toEqual({ a: 1, b: 2 });
  });

  test("accepts trailing commas in objects", () => {
    expect(parseJsonc('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
  });

  test("accepts trailing commas in arrays", () => {
    expect(parseJsonc("[1,2,3,]")).toEqual([1, 2, 3]);
  });

  test("does not mis-strip // inside string values", () => {
    const raw = '{"url":"https://example.com/path"}';
    expect(parseJsonc(raw)).toEqual({ url: "https://example.com/path" });
  });

  test("does not mis-strip /* inside string values", () => {
    const raw = '{"pattern":"/* keep me */"}';
    expect(parseJsonc(raw)).toEqual({ pattern: "/* keep me */" });
  });

  test("throws SyntaxError on missing quotes", () => {
    expect(() => parseJsonc("{a:1}")).toThrow(SyntaxError);
  });

  test("throws SyntaxError on truncated input", () => {
    expect(() => parseJsonc('{"a":')).toThrow(SyntaxError);
  });

  test("real-world opencode.json with comments and trailing commas", () => {
    const raw = `{
      // $schema declares the config shape
      "$schema": "https://opencode.ai/config.json",
      "model": "anthropic/claude-sonnet-4-5",
      "provider": {
        "cursor-acp": {
          "models": {
            "gpt-5": { "name": "GPT-5" }, // newest model
          },
        },
      },
    }`;
    expect(parseJsonc(raw)).toEqual({
      $schema: "https://opencode.ai/config.json",
      model: "anthropic/claude-sonnet-4-5",
      provider: {
        "cursor-acp": {
          models: {
            "gpt-5": { name: "GPT-5" },
          },
        },
      },
    });
  });
});
