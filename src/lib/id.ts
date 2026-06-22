import { nanoid } from 'nanoid';

/** Generate a short, URL-safe unique id (default 12 chars). */
export function newId(size = 12): string {
  return nanoid(size);
}
