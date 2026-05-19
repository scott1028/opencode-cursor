import { parse, printParseErrorCode, type ParseError } from "jsonc-parser/lib/esm/main.js";

export function parseJsonc(raw: string): ReturnType<typeof JSON.parse> {
  const errors: ParseError[] = [];
  const result = parse(raw, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const first = errors[0];
    throw new SyntaxError(
      `JSONC parse error: ${printParseErrorCode(first.error)} at offset ${first.offset}`,
    );
  }
  return result;
}
