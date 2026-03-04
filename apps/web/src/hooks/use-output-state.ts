import { useReducer, useCallback } from "react";
import type { ContentBlock } from "@vie/types";

const MAX_UNDO = 50;

interface State {
  blocks: ContentBlock[];
  undoStack: ContentBlock[][];
  redoStack: ContentBlock[][];
  isDirty: boolean;
}

type Action =
  | { type: "UPDATE_BLOCK"; index: number; block: ContentBlock }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; blocks: ContentBlock[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "UPDATE_BLOCK": {
      const snapshot = structuredClone(state.blocks);
      const newUndo = [...state.undoStack, snapshot];
      return {
        blocks: state.blocks.map((b, i) =>
          i === action.index ? action.block : b
        ),
        undoStack:
          newUndo.length > MAX_UNDO ? newUndo.slice(-MAX_UNDO) : newUndo,
        redoStack: [],
        isDirty: true,
      };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const rest = state.undoStack.slice(0, -1);
      return {
        blocks: prev,
        undoStack: rest,
        redoStack: [...state.redoStack, structuredClone(state.blocks)],
        isDirty: rest.length > 0,
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const rest = state.redoStack.slice(0, -1);
      return {
        blocks: next,
        undoStack: [...state.undoStack, structuredClone(state.blocks)],
        redoStack: rest,
        isDirty: true,
      };
    }
    case "RESET":
      return {
        blocks: action.blocks,
        undoStack: [],
        redoStack: [],
        isDirty: false,
      };
  }
}

interface OutputState {
  blocks: ContentBlock[];
  isDirty: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  updateBlock: (index: number, updatedBlock: ContentBlock) => void;
  reset: (blocks: ContentBlock[]) => void;
}

/**
 * Manages editable content blocks with undo/redo.
 * `initialBlocks` is only used on first render.
 * Call `reset(newBlocks)` or re-mount with a different `key` to sync new data.
 */
export function useOutputState(initialBlocks: ContentBlock[]): OutputState {
  const [state, dispatch] = useReducer(reducer, {
    blocks: initialBlocks,
    undoStack: [],
    redoStack: [],
    isDirty: false,
  });

  const updateBlock = useCallback(
    (index: number, updatedBlock: ContentBlock) => {
      dispatch({ type: "UPDATE_BLOCK", index, block: updatedBlock });
    },
    []
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const reset = useCallback((blocks: ContentBlock[]) => {
    dispatch({ type: "RESET", blocks });
  }, []);

  return {
    blocks: state.blocks,
    isDirty: state.isDirty,
    undo,
    redo,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    updateBlock,
    reset,
  };
}
