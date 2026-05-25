// tests/mocks/next-headers.ts
// Stubs for next/headers APIs that throw "static generation store missing"
// outside a real Next.js request context (server actions called from Vitest).

const emptyCookies = {
  get: (_name: string) => undefined,
  has: (_name: string) => false,
  getAll: () => [] as { name: string; value: string }[],
  set: () => {},
  delete: () => {},
  toString: () => "",
  size: 0,
  [Symbol.iterator]: function* () {},
  entries: function* () {},
  keys: function* () {},
  values: function* () {},
  forEach: () => {},
};

const emptyHeaders = {
  get: (_name: string) => null,
  has: (_name: string) => false,
  getAll: () => [] as string[],
  entries: function* () {},
  keys: function* () {},
  values: function* () {},
  forEach: () => {},
  [Symbol.iterator]: function* () {},
};

export const cookies = async () => emptyCookies;
export const headers = async () => emptyHeaders;
