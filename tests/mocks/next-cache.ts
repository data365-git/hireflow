// No-op stubs for Next.js cache APIs.
// In the test environment there is no Next.js HTTP request context,
// so revalidatePath / revalidateTag throw "static generation store missing".
export const revalidatePath = (_path: string) => {};
export const revalidateTag = (_tag: string) => {};
export const unstable_cache = <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;
