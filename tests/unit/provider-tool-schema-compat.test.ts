import { describe, expect, it } from "bun:test";
import {
  applyToolSchemaCompat,
  buildToolSchemaMap,
} from "../../src/provider/tool-schema-compat";

describe("tool schema compatibility", () => {
  const editSchema = {
    type: "object",
    properties: {
      path: { type: "string" },
      old_string: { type: "string" },
      new_string: { type: "string" },
    },
    required: ["path", "old_string", "new_string"],
    additionalProperties: false,
  };

  const writeSchema = {
    type: "object",
    properties: {
      path: { type: "string" },
      content: { type: "string" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  };

  const editOnlySchemaMap = () => new Map([["edit", editSchema]]);
  const editWriteSchemaMap = () => new Map([
    ["edit", editSchema],
    ["write", writeSchema],
  ]);

  it("normalizes common argument aliases to canonical keys", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1",
        type: "function",
        function: {
          name: "write",
          arguments: JSON.stringify({
            filePath: "/tmp/a.txt",
            contents: "hello",
          }),
        },
      },
      new Map([
        [
          "write",
          {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        ],
      ]),
    );

    expect(result.normalizedArgs.path).toBe("/tmp/a.txt");
    expect(result.normalizedArgs.content).toBe("hello");
    expect(result.normalizedArgs.filePath).toBeUndefined();
    expect(result.normalizedArgs.contents).toBeUndefined();
    expect(result.validation.ok).toBe(true);
  });

  it("normalizes filename alias to path", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1",
        type: "function",
        function: {
          name: "write",
          arguments: JSON.stringify({
            filename: "/tmp/b.txt",
            content: "hello",
          }),
        },
      },
      new Map([
        [
          "write",
          {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        ],
      ]),
    );

    expect(result.normalizedArgs.path).toBe("/tmp/b.txt");
    expect(result.normalizedArgs.filename).toBeUndefined();
    expect(result.validation.ok).toBe(true);
  });

  it("normalizes glob aliases targetDirectory/globPattern", () => {
    const result = applyToolSchemaCompat(
      {
        id: "g1",
        type: "function",
        function: {
          name: "glob",
          arguments: JSON.stringify({
            targetDirectory: "TOOL_SMOKE_DIR",
            globPattern: "**/*.txt",
          }),
        },
      },
      new Map([
        [
          "glob",
          {
            type: "object",
            properties: {
              path: { type: "string" },
              pattern: { type: "string" },
            },
            required: ["pattern"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    expect(result.normalizedArgs.path).toBe("TOOL_SMOKE_DIR");
    expect(result.normalizedArgs.pattern).toBe("**/*.txt");
    expect(result.normalizedArgs.targetDirectory).toBeUndefined();
    expect(result.normalizedArgs.globPattern).toBeUndefined();
    expect(result.validation.ok).toBe(true);
  });

  it("normalizes grep aliases searchPattern/includePattern", () => {
    const result = applyToolSchemaCompat(
      {
        id: "g2",
        type: "function",
        function: {
          name: "grep",
          arguments: JSON.stringify({
            searchPattern: "beta",
            filePath: "TOOL_SMOKE_DIR/src/grep.txt",
            includePattern: "*.txt",
          }),
        },
      },
      new Map([
        [
          "grep",
          {
            type: "object",
            properties: {
              pattern: { type: "string" },
              path: { type: "string" },
              include: { type: "string" },
            },
            required: ["pattern", "path"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    expect(result.normalizedArgs.pattern).toBe("beta");
    expect(result.normalizedArgs.path).toBe("TOOL_SMOKE_DIR/src/grep.txt");
    expect(result.normalizedArgs.include).toBe("*.txt");
    expect(result.normalizedArgs.searchPattern).toBeUndefined();
    expect(result.validation.ok).toBe(true);
  });

  it("normalizes bash aliases command/cwd", () => {
    const result = applyToolSchemaCompat(
      {
        id: "b1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({
            cmd: "pwd",
            workdir: "/tmp",
          }),
        },
      },
      new Map([
        [
          "bash",
          {
            type: "object",
            properties: {
              command: { type: "string" },
              cwd: { type: "string" },
            },
            required: ["command"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    expect(result.normalizedArgs.command).toBe("pwd");
    expect(result.normalizedArgs.cwd).toBe("/tmp");
    expect(result.normalizedArgs.cmd).toBeUndefined();
    expect(result.normalizedArgs.workdir).toBeUndefined();
    expect(result.validation.ok).toBe(true);
  });

  it("normalizes rm recursive string alias into boolean force", () => {
    const result = applyToolSchemaCompat(
      {
        id: "r1",
        type: "function",
        function: {
          name: "rm",
          arguments: JSON.stringify({
            targetPath: "/tmp/to-delete",
            recursive: "true",
          }),
        },
      },
      new Map([
        [
          "rm",
          {
            type: "object",
            properties: {
              path: { type: "string" },
              force: { type: "boolean" },
            },
            required: ["path"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    expect(result.normalizedArgs.path).toBe("/tmp/to-delete");
    expect(result.normalizedArgs.force).toBe(true);
    expect(result.validation.ok).toBe(true);
  });

  it("keeps canonical keys when aliases collide", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1",
        type: "function",
        function: {
          name: "read",
          arguments: JSON.stringify({
            path: "/canonical.txt",
            filePath: "/alias.txt",
          }),
        },
      },
      new Map(),
    );

    expect(result.normalizedArgs.path).toBe("/canonical.txt");
    expect(result.normalizedArgs.filePath).toBeUndefined();
    expect(result.collisionKeys).toContain("filePath");
  });

  it("normalizes todowrite statuses and default priority", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1",
        type: "function",
        function: {
          name: "todowrite",
          arguments: JSON.stringify({
            todos: [
              { content: "Book flights", status: "todo" },
              { content: "Reserve hotel", status: "in-progress", priority: "high" },
              { content: "Buy adapter", status: "done" },
              { content: "Pack", status: "TODO_STATUS_IN_PROGRESS" },
              { content: "Land", status: "TODO_STATUS_COMPLETED" },
            ],
          }),
        },
      },
      new Map(),
    );

    const todos = result.normalizedArgs.todos as Array<any>;
    expect(todos[0].status).toBe("pending");
    expect(todos[0].priority).toBe("medium");
    expect(todos[1].status).toBe("in_progress");
    expect(todos[1].priority).toBe("high");
    expect(todos[2].status).toBe("completed");
    expect(todos[2].priority).toBe("medium");
    expect(todos[3].status).toBe("in_progress");
    expect(todos[3].priority).toBe("medium");
    expect(todos[4].status).toBe("completed");
    expect(todos[4].priority).toBe("medium");
  });

  it("reroutes edit content payloads to write when write is available", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "/tmp/todo.md",
            content: "new full content",
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("write");
    expect(args.path).toBe("/tmp/todo.md");
    expect(args.content).toBe("new full content");
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.missing).toEqual([]);
    expect(result.validation.typeErrors).toEqual([]);
  });

  it("keeps edit content payloads invalid when write is unavailable", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1_no_write",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "/tmp/todo.md",
            content: "new full content",
          }),
        },
      },
      editOnlySchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("edit");
    expect(args.path).toBe("/tmp/todo.md");
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBe("new full content");
    expect(args.content).toBeUndefined();
    expect(result.validation.ok).toBe(false);
    expect(result.validation.missing).toEqual(["old_string"]);
  });

  it("repairs edit content into new_string without rerouting when path is missing", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c_missing_path",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            content: "new full content",
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("edit");
    expect(args.new_string).toBe("new full content");
    expect(args.old_string).toBeUndefined();
    expect(result.validation.ok).toBe(false);
    expect(result.validation.missing).toEqual(["path", "old_string"]);
  });

  it("strips unsupported fields when schema disallows additional properties", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c1",
        type: "function",
        function: {
          name: "todowrite",
          arguments: JSON.stringify({
            todos: [{ content: "Book flights", status: "pending" }],
            merge: true,
          }),
        },
      },
      new Map([
        [
          "todowrite",
          {
            type: "object",
            properties: {
              todos: { type: "array" },
            },
            required: ["todos"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(args.todos).toBeDefined();
    expect(args.merge).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.unexpected).toEqual(["merge"]);
  });

  it("reroutes edit streamContent aliases to write", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c2",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "TODO.md",
            streamContent: "updated body",
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("write");
    expect(args.path).toBe("TODO.md");
    expect(args.content).toBe("updated body");
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.missing).toEqual([]);
  });

  it("coerces array streamContent chunks and reroutes edit to write", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c3",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "TODO.md",
            streamContent: ["# Travel Plan\n", "- Flight\n", "- Hotel\n"],
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("write");
    expect(args.path).toBe("TODO.md");
    expect(args.content).toBe("# Travel Plan\n- Flight\n- Hotel\n");
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBeUndefined();
    expect(args.streamContent).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.missing).toEqual([]);
  });

  it("coerces object-wrapped content and reroutes edit to write", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c4",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "SIMPLE_TEST.md",
            streamContent: { text: "ok", type: "full" },
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("write");
    expect(args.path).toBe("SIMPLE_TEST.md");
    expect(typeof args.content).toBe("string");
    expect(args.content.length).toBeGreaterThan(0);
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.missing).toEqual([]);
  });

  it("coerces nested array of {text} chunk objects and reroutes edit to write", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c5",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "TODO.md",
            streamContent: [
              { text: "# Plan\n" },
              { text: "- Step 1\n" },
              { text: "- Step 2\n" },
            ],
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("write");
    expect(args.path).toBe("TODO.md");
    expect(args.content).toBe("# Plan\n- Step 1\n- Step 2\n");
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.missing).toEqual([]);
  });

  it("reroutes explicit empty edit old_string to write when write is available", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c_empty_old",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "TODO.md",
            old_string: "",
            new_string: "-- test\nreturn {",
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("write");
    expect(args.path).toBe("TODO.md");
    expect(args.content).toBe("-- test\nreturn {");
    expect(args.old_string).toBeUndefined();
    expect(args.new_string).toBeUndefined();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.missing).toEqual([]);
  });

  it("preserves valid edit calls with explicit old/new strings", () => {
    const result = applyToolSchemaCompat(
      {
        id: "c6",
        type: "function",
        function: {
          name: "edit",
          arguments: JSON.stringify({
            path: "file.ts",
            old_string: "foo",
            new_string: "bar",
          }),
        },
      },
      editWriteSchemaMap(),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(result.toolCall.function.name).toBe("edit");
    expect(args.path).toBe("file.ts");
    expect(args.old_string).toBe("foo");
    expect(args.new_string).toBe("bar");
    expect(result.validation.ok).toBe(true);
  });

  it("builds schema map from request tools", () => {
    const map = buildToolSchemaMap([
      {
        type: "function",
        function: {
          name: "read",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
        },
      },
      {
        name: "todowrite",
        parameters: {
          type: "object",
          properties: { todos: { type: "array" } },
          required: ["todos"],
        },
      },
    ]);

    expect(map.has("read")).toBe(true);
    expect(map.has("todowrite")).toBe(true);
  });

  it("coerces non-string write content into a string", () => {
    const result = applyToolSchemaCompat(
      {
        id: "w1",
        type: "function",
        function: {
          name: "write",
          arguments: JSON.stringify({
            path: "/tmp/a.txt",
            content: [{ text: "hello" }, { text: " world" }],
          }),
        },
      },
      new Map([
        [
          "write",
          {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(args.path).toBe("/tmp/a.txt");
    expect(args.content).toBe("hello world");
    expect(result.validation.ok).toBe(true);
  });

  it("repairs write new_string into content", () => {
    const result = applyToolSchemaCompat(
      {
        id: "w2",
        type: "function",
        function: {
          name: "write",
          arguments: JSON.stringify({
            path: "/tmp/b.txt",
            new_string: "hello",
          }),
        },
      },
      new Map([
        [
          "write",
          {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        ],
      ]),
    );

    const args = JSON.parse(result.toolCall.function.arguments);
    expect(args.path).toBe("/tmp/b.txt");
    expect(args.content).toBe("hello");
    expect(args.new_string).toBeUndefined();
    expect(result.validation.ok).toBe(true);
  });
});
