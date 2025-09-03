// Simple test setup without React Native dependencies

// Mock fetch
(global as any).fetch = jest.fn();

// Mock Date properly to preserve Date.now functionality
const mockDate = new Date('2025-08-31T20:00:00Z'); // 8 PM UTC

global.Date = class extends Date {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(mockDate.getTime());
    } else {
      // @ts-ignore - TypeScript doesn't like spread in super() but it works
      super(...args);
    }
  }

  static now() {
    return mockDate.getTime();
  }
} as any;
