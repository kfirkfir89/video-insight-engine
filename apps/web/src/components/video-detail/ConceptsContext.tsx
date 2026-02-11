import { createContext, useContext, type ReactNode } from 'react';
import type { Concept } from '@vie/types';

const ConceptsContext = createContext<Concept[]>([]);

interface ConceptsProviderProps {
  concepts: Concept[];
  children: ReactNode;
}

export function ConceptsProvider({ concepts, children }: ConceptsProviderProps) {
  return (
    <ConceptsContext.Provider value={concepts}>
      {children}
    </ConceptsContext.Provider>
  );
}

export function useConcepts(): Concept[] {
  return useContext(ConceptsContext);
}
