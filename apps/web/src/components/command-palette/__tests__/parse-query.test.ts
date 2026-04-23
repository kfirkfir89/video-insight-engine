import { describe, it, expect } from "vitest";
import { parsePaletteQuery } from "../parse-query";

describe("parsePaletteQuery", () => {
  it("should return empty text and null filter for an empty string", () => {
    expect(parsePaletteQuery("")).toEqual({ textQuery: "", statusFilter: null });
    expect(parsePaletteQuery("   ")).toEqual({ textQuery: "", statusFilter: null });
  });

  it("should return free text with no filter when no operators are used", () => {
    expect(parsePaletteQuery("meditation retreat")).toEqual({
      textQuery: "meditation retreat",
      statusFilter: null,
    });
  });

  it("should extract is:processing as pending + processing", () => {
    const result = parsePaletteQuery("is:processing");
    expect(result.textQuery).toBe("");
    expect(result.statusFilter).toEqual(
      expect.arrayContaining(["pending", "processing"]),
    );
    expect(result.statusFilter?.length).toBe(2);
  });

  it("should extract is:done as completed", () => {
    expect(parsePaletteQuery("is:done")).toEqual({
      textQuery: "",
      statusFilter: ["completed"],
    });
  });

  it("should extract is:failed as failed", () => {
    expect(parsePaletteQuery("is:failed")).toEqual({
      textQuery: "",
      statusFilter: ["failed"],
    });
  });

  it("should combine status filter with free text", () => {
    const result = parsePaletteQuery("is:failed meditation");
    expect(result.textQuery).toBe("meditation");
    expect(result.statusFilter).toEqual(["failed"]);
  });

  it("should union multiple status operators", () => {
    const result = parsePaletteQuery("is:done is:failed");
    expect(result.textQuery).toBe("");
    expect(result.statusFilter).toEqual(
      expect.arrayContaining(["completed", "failed"]),
    );
    expect(result.statusFilter?.length).toBe(2);
  });

  it("should be case-insensitive for operators", () => {
    expect(parsePaletteQuery("IS:Done")).toEqual({
      textQuery: "",
      statusFilter: ["completed"],
    });
  });

  it("should pass unknown is:* tokens through as free text", () => {
    const result = parsePaletteQuery("is:archived meditation");
    expect(result.textQuery).toBe("is:archived meditation");
    expect(result.statusFilter).toBeNull();
  });

  it("should accept common synonyms", () => {
    expect(parsePaletteQuery("is:complete").statusFilter).toEqual(["completed"]);
    expect(parsePaletteQuery("is:error").statusFilter).toEqual(["failed"]);
  });
});
