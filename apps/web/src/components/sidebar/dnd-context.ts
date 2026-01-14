import { createContext, useContext } from "react";

// Context to share overFolderId state between DndProvider and consuming components
export const DndStateContext = createContext<string | null>(null);

export function useOverFolderId() {
  return useContext(DndStateContext);
}
