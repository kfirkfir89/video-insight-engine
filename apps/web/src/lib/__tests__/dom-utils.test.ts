import { describe, it, expect, beforeEach } from "vitest";
import { findScrollParent } from "../dom-utils";

describe("dom-utils", () => {
  describe("findScrollParent", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
    });

    it("should find parent with overflow-y: auto", () => {
      const container = document.createElement("div");
      container.style.overflowY = "auto";
      const child = document.createElement("div");
      container.appendChild(child);
      document.body.appendChild(container);

      expect(findScrollParent(child)).toBe(container);
    });

    it("should find parent with overflow-y: scroll", () => {
      const container = document.createElement("div");
      container.style.overflowY = "scroll";
      const child = document.createElement("div");
      container.appendChild(child);
      document.body.appendChild(container);

      expect(findScrollParent(child)).toBe(container);
    });

    it("should find nearest scrollable ancestor, not furthest", () => {
      const outer = document.createElement("div");
      outer.style.overflowY = "auto";
      const inner = document.createElement("div");
      inner.style.overflowY = "scroll";
      const child = document.createElement("div");
      inner.appendChild(child);
      outer.appendChild(inner);
      document.body.appendChild(outer);

      expect(findScrollParent(child)).toBe(inner);
    });

    it("should fall back to document.documentElement when no scrollable parent", () => {
      const container = document.createElement("div");
      const child = document.createElement("div");
      container.appendChild(child);
      document.body.appendChild(container);

      expect(findScrollParent(child)).toBe(document.documentElement);
    });
  });
});
