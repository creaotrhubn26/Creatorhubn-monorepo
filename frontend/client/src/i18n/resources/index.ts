import { no } from './no';
import { en } from './en';

export type Lang = 'no' | 'en';
export type TranslationKey = keyof typeof no;

export const resources: Record<Lang, Record<TranslationKey, string>> = { no, en };
