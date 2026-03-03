declare module 'react-beautiful-dnd' {
  import * as React from 'react';

  export interface DraggableLocation {
    droppableId: string;
    index: number;
  }

  export interface DropResult {
    draggableId: string;
    type: string;
    source: DraggableLocation;
    destination: DraggableLocation | null;
    reason: 'DROP' | 'CANCEL';
    mode?: 'FLUID' | 'SNAP';
    combine?: unknown;
  }

  export interface DroppableProvided {
    innerRef: (element: HTMLElement | null) => void;
    droppableProps: React.HTMLAttributes<HTMLElement>;
    placeholder: React.ReactNode;
  }

  export interface DroppableStateSnapshot {
    isDraggingOver: boolean;
    draggingOverWith?: string | null;
    draggingFromThisWith?: string | null;
    isUsingPlaceholder: boolean;
  }

  export interface DraggableProvided {
    innerRef: (element: HTMLElement | null) => void;
    draggableProps: React.HTMLAttributes<HTMLElement>;
    dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  }

  export interface DraggableStateSnapshot {
    isDragging: boolean;
    isDropAnimating: boolean;
    dropAnimation?: unknown;
    draggingOver?: string | null;
    combineWith?: string | null;
    combineTargetFor?: string | null;
    mode?: 'FLUID' | 'SNAP';
  }

  export interface DragDropContextProps {
    onDragEnd: (result: DropResult) => void;
    onDragStart?: (start: unknown) => void;
    onDragUpdate?: (update: unknown) => void;
    children: React.ReactNode;
  }

  export const DragDropContext: React.FC<DragDropContextProps>;

  export interface DroppableProps {
    droppableId: string;
    type?: string;
    isDropDisabled?: boolean;
    direction?: 'vertical' | 'horizontal';
    children: (provided: DroppableProvided, snapshot: DroppableStateSnapshot) => React.ReactElement;
  }

  export const Droppable: React.FC<DroppableProps>;

  export interface DraggableProps {
    draggableId: string;
    index: number;
    isDragDisabled?: boolean;
    disableInteractiveElementBlocking?: boolean;
    children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => React.ReactElement;
  }

  export const Draggable: React.FC<DraggableProps>;
}

