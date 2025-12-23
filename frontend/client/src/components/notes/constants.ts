// client/src/components/notes/constants.ts
// Centralized constants for the Notes feature

export const quillFormats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'blockquote',
  'code-block',
  'list',
  'bullet',
  'indent',
  'link',
  'image',
  'color',
  'background',
  'align',
  'clean'
];

export const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ['bold','italic','underline','strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['blockquote','code-block'],
    ['link','image'],
    ['clean'],
  ],
};

export type NoteListItem = {
  id: string;
  title: string;
  updatedAt?: string | number | Date;
  tags?: string[]
};

export const EMPTY_HTML ='';
