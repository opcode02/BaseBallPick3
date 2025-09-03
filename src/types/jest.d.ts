/// <reference types="jest" />

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOnTheScreen(): R;
      toHaveProp(prop: string, value?: any): R;
    }
  }
}
