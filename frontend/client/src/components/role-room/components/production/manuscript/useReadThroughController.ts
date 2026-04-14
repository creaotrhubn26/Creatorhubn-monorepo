import { useState } from 'react';

export const useReadThroughController = () => {
  const [readThroughMode, setReadThroughMode] = useState(false);
  const [readThroughPlaying, setReadThroughPlaying] = useState(false);
  const [readThroughCurrentLine, setReadThroughCurrentLine] = useState(0);
  const [readThroughStartTime, setReadThroughStartTime] = useState<number | null>(null);
  const [readThroughNotes, setReadThroughNotes] = useState<Record<number, string>>({});

  const resetReadThrough = () => {
    setReadThroughPlaying(false);
    setReadThroughCurrentLine(0);
    setReadThroughStartTime(null);
  };

  return {
    readThroughMode,
    setReadThroughMode,
    readThroughPlaying,
    setReadThroughPlaying,
    readThroughCurrentLine,
    setReadThroughCurrentLine,
    readThroughStartTime,
    setReadThroughStartTime,
    readThroughNotes,
    setReadThroughNotes,
    resetReadThrough,
  };
};
