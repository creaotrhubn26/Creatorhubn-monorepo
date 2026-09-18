/**
 * NarrativePlayPanel — Play-fanen i arbeidsflaten: StoryPlayer med debugger
 * og «Rediger element». Den offentlige delingssiden bruker StoryPlayer direkte.
 */

import React from 'react';
import type { NarrativeGraph } from '../narrativeTypes';
import { StoryPlayer } from './StoryPlayer';

export interface NarrativePlayPanelProps {
  graph: NarrativeGraph;
  onEditElement: (elementId: string) => void;
}

export function NarrativePlayPanel({ graph, onEditElement }: NarrativePlayPanelProps) {
  return <StoryPlayer graph={graph} onEditElement={onEditElement} showDebugger />;
}
