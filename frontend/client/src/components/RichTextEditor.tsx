import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'quill/dist/quill.snow.css';

type QuillProps = React.ComponentProps<typeof ReactQuill>;

const DEFAULT_MODULES: QuillProps['modules'] = {
  toolbar: [
    ['bold','italic','underline','strike'],
    [{ header: [1, 2, false] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link','image'],
    ['clean'],
  ],
};

const DEFAULT_FORMATS: QuillProps['formats'] = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'link',
  'image',
];

export default function RichTextEditor(props: QuillProps) {
  const modules = useMemo(() => props.modules ?? DEFAULT_MODULES, [props.modules]);
  const formats = useMemo(() => props.formats ?? DEFAULT_FORMATS, [props.formats]);
  return <ReactQuill theme={props.theme ??'snow'} {...props} modules={modules} formats={formats} />;
}
