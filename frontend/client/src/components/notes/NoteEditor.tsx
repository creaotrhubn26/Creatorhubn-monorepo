// client/src/components/notes/NoteEditor.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { Suspense } from 'react';
const ReactQuill = React.lazy(() => import('react-quill')); // resolved by Vite alias if configured

type Props = {
  value: string;
  onChange: (html: string) => void;
  modules?: any;
  formats?: string[];
  placeholder?: string;
  readOnly?: boolean;
};

export default function NoteEditor({
  value,
  onChange,
  modules,
  formats,
  placeholder ='Skriv notatet her…',
  readOnly = false,
}: Props) {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Laster editor …</div>}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </Suspense>
  );
}
