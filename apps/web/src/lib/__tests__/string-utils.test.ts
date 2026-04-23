import { describe, it, expect } from "vitest";
import { formatDuration, formatDurationHuman, getInitials, timeAgo } from "../string-utils";

describe("string-utils", () => {
  describe("getInitials", () => {
    it("should return two initials for a two-word name", () => {
      expect(getInitials("Ada Lovelace")).toBe("AL");
    });

    it("should return one initial for a single-word name", () => {
      expect(getInitials("Ada")).toBe("A");
    });

    it("should fall back to the first letter of the email when name is blank", () => {
      expect(getInitials("", "kfir@example.com")).toBe("K");
      expect(getInitials(undefined, "kfir@example.com")).toBe("K");
      expect(getInitials("   ", "kfir@example.com")).toBe("K");
    });

    it("should prefer name over email when both are present", () => {
      expect(getInitials("Ada Lovelace", "zeta@example.com")).toBe("AL");
    });

    it("should return 'U' when both name and email are blank", () => {
      expect(getInitials(undefined)).toBe("U");
      expect(getInitials("", "")).toBe("U");
      expect(getInitials(null, null)).toBe("U");
    });

    it("should always uppercase the result", () => {
      expect(getInitials("ada")).toBe("A");
      expect(getInitials("", "zeta@example.com")).toBe("Z");
    });
  });


  describe("formatDuration", () => {
    it("should format seconds into m:ss", () => {
      expect(formatDuration(0)).toBe("0:00");
      expect(formatDuration(5)).toBe("0:05");
      expect(formatDuration(65)).toBe("1:05");
      expect(formatDuration(600)).toBe("10:00");
    });

    it("should format hours into h:mm:ss", () => {
      expect(formatDuration(3600)).toBe("1:00:00");
      expect(formatDuration(3661)).toBe("1:01:01");
      expect(formatDuration(7200)).toBe("2:00:00");
    });

    it("should handle null and undefined", () => {
      expect(formatDuration(null)).toBe("--:--");
      expect(formatDuration(undefined)).toBe("--:--");
    });

    it("should handle negative values", () => {
      expect(formatDuration(-1)).toBe("--:--");
      expect(formatDuration(-100)).toBe("--:--");
    });

    it("should floor fractional seconds", () => {
      expect(formatDuration(65.7)).toBe("1:05");
      expect(formatDuration(0.9)).toBe("0:00");
    });
  });

  describe("formatDurationHuman", () => {
    it("should format seconds only", () => {
      expect(formatDurationHuman(5)).toBe("5s");
      expect(formatDurationHuman(59)).toBe("59s");
    });

    it("should format minutes only when no remainder", () => {
      expect(formatDurationHuman(60)).toBe("1m");
      expect(formatDurationHuman(120)).toBe("2m");
    });

    it("should format minutes and seconds", () => {
      expect(formatDurationHuman(90)).toBe("1m 30s");
      expect(formatDurationHuman(150)).toBe("2m 30s");
    });

    it("should handle zero", () => {
      expect(formatDurationHuman(0)).toBe("0s");
    });
  });

  describe("timeAgo", () => {
    it("should return 'just now' for very recent times", () => {
      const now = new Date().toISOString();
      expect(timeAgo(now)).toBe("just now");
    });

    it("should return minutes ago", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(fiveMinAgo)).toBe("5m ago");
    });

    it("should return hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoHoursAgo)).toBe("2h ago");
    });

    it("should return days ago", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(threeDaysAgo)).toBe("3d ago");
    });

    it("should return formatted date for old dates", () => {
      const oldDate = new Date("2020-01-15").toISOString();
      const result = timeAgo(oldDate);
      // Should contain the date, not relative time
      expect(result).not.toContain("ago");
      expect(result).toBeTruthy();
    });

    it("should return empty string for invalid dates", () => {
      expect(timeAgo("not-a-date")).toBe("");
      expect(timeAgo("")).toBe("");
    });
  });
});
