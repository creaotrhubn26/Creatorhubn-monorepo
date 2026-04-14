import { useCallback, useEffect, useRef, type ChangeEvent } from 'react';

interface UseObjectUrlUploadsOptions {
  maxFiles: number;
  currentCount: number;
  maxFileSize: number;
  allowedTypes: string[];
  onObjectUrl: (url: string) => void;
}

export const useObjectUrlUploads = ({
  maxFiles,
  currentCount,
  maxFileSize,
  allowedTypes,
  onObjectUrl,
}: UseObjectUrlUploadsOptions) => {
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => (
    () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    }
  ), []);

  const handleObjectUrlUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        console.warn(`Skipped "${file.name}": unsupported type ${file.type}`);
        return;
      }
      if (file.size > maxFileSize) {
        console.warn(`Skipped "${file.name}": exceeds ${maxFileSize / 1024 / 1024}MB limit`);
        return;
      }
      if (currentCount >= maxFiles) {
        console.warn(`Upload limit (${maxFiles}) reached`);
        return;
      }

      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      onObjectUrl(url);
    });
  }, [allowedTypes, currentCount, maxFileSize, maxFiles, onObjectUrl]);

  return { handleObjectUrlUpload };
};
