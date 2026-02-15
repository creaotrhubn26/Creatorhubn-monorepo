import React, { createContext, useContext, useState, ReactNode } from 'react';

interface VisualEditorContextType {
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  selectedElement: string | null;
  setSelectedElement: (id: string | null) => void;
}

const VisualEditorContext = createContext<VisualEditorContextType | undefined>(undefined);

export function VisualEditorProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  return (
    <VisualEditorContext.Provider value={{
      isEditing,
      setIsEditing,
      selectedElement,
      setSelectedElement,
    }}>
      {children}
    </VisualEditorContext.Provider>
  );
}

export function useVisualEditor() {
  const context = useContext(VisualEditorContext);
  if (!context) {
    return {
      isEditing: false,
      setIsEditing: () => {},
      selectedElement: null,
      setSelectedElement: () => {},
    };
  }
  return context;
}
