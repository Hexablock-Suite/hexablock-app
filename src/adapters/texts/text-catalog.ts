import { en } from './en';
import { es } from './es';

// The typed text catalog of the app (APP-FR-11, issue #154). A screen shows a text
// through its key, never through a literal text. Rule R-text-catalog in `AGENTS.md`.

export type Language = 'es' | 'en';

// The key of one visible text. It joins the keys of both languages. So the type check
// fails when one language lacks a key of the other.
export type TextKey = keyof typeof es | keyof typeof en;

export type Texts = Readonly<Record<TextKey, string>>;

export const textCatalog: Readonly<Record<Language, Texts>> = { es, en };

// The screens show this language until the player can choose one (#163).
export const DEFAULT_LANGUAGE: Language = 'es';
