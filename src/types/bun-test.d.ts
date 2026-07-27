declare module "bun:test" {
  type TestCallback = () => void | Promise<void>

  interface Matchers {
    not: Matchers
    toBe(expected: unknown): void
    toBeNull(): void
    toEqual(expected: unknown): void
    toHaveProperty(property: string): void
  }

  export function describe(name: string, callback: TestCallback): void
  export function afterAll(callback: TestCallback): void
  export function beforeEach(callback: TestCallback): void
  export function test(name: string, callback: TestCallback): void
  export function expect(value: unknown): Matchers
  export const mock: {
    module(
      specifier: string,
      factory: () => Record<string, unknown>,
    ): void
    restore(): void
  }
}
