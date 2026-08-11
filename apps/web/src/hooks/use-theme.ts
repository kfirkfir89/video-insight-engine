import { useContext } from "react";
import { ThemeContext } from "@/components/theme-context";

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
