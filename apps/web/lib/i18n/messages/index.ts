import type { LocaleCode } from "../locales";
import type { MessageTree } from "./en";
import { en } from "./en";
import { yo } from "./yo";
import { ha } from "./ha";
import { ig } from "./ig";
import {
  am,
  ar,
  bn,
  fil,
  fr,
  hi,
  id,
  ja,
  ko,
  ms,
  pt,
  sw,
  th,
  ur,
  vi,
  zh,
} from "./rest";

const TABLE: Record<LocaleCode, MessageTree> = {
  en,
  yo,
  ha,
  ig,
  fr,
  sw,
  ar,
  pt,
  am,
  hi,
  zh,
  id,
  th,
  vi,
  ms,
  ja,
  ko,
  bn,
  fil,
  ur,
};

function dig(tree: MessageTree, parts: string[]): string | undefined {
  let cur: string | MessageTree | undefined = tree;
  for (const p of parts) {
    if (!cur || typeof cur === "string") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(locale: LocaleCode, key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");
  const raw =
    dig(TABLE[locale] || en, parts) ||
    dig(en, parts) ||
    key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    raw,
  );
}

export function getMessages(locale: LocaleCode): MessageTree {
  return TABLE[locale] || en;
}
