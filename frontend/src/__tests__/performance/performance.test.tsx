/**
 * Performance testing suite for ClaudeIQ frontend components
 */
import React from "react";
import { performance } from "perf_hooks";
import { render, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/utils/test-utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AppStateProvider } from "@/store/appState";

// Performance thresholds (in milliseconds)
const RENDER_THRESHOLD = 50;
const HEAVY_RENDER_THRESHOLD = 200;

// Performance measurement utilities
const measureRenderTime = (
  Component: React.ComponentType<any>,
  props: any = {},
  iterations: number = 10
) => {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const { unmount } = render(<Component {...props} />);
    const end = performance.now();
    times.push(end - start);
    unmount();
  }

  return times.reduce((acc, time) => acc + time, 0) / times.length;
};

const measureRenderTimeWithProviders = (
  component: React.ReactElement,
  iterations: number = 10
) => {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const { unmount } = renderWithProviders(component);
    const end = performance.now();
    times.push(end - start);
    unmount();
  }

  return times.reduce((acc, time) => acc + time, 0) / times.length;
};

describe("Performance Tests", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Component Render Performance", () => {
    it("Button component renders within performance threshold", () => {
      const avgTime = measureRenderTime(Button, { children: "Test" });
      expect(avgTime).toBeLessThan(RENDER_THRESHOLD);
    });

    it("Input component renders within performance threshold", () => {
      const avgTime = measureRenderTime(Input, { placeholder: "Test" });
      expect(avgTime).toBeLessThan(RENDER_THRESHOLD);
    });

    it("Modal component renders within performance threshold", () => {
      const avgTime = measureRenderTime(Modal, {
        isOpen: true,
        onClose: () => {},
        title: "Test Modal",
        children: <div>Modal content</div>,
      });
      expect(avgTime).toBeLessThan(HEAVY_RENDER_THRESHOLD);
    });
  });

  describe("Provider Performance", () => {
    it("Components with providers render within threshold", () => {
      const avgTime = measureRenderTimeWithProviders(
        <AppStateProvider>
          <div>Test content</div>
        </AppStateProvider>
      );
      expect(avgTime).toBeLessThan(RENDER_THRESHOLD);
    });

    it("Complex component tree renders within threshold", () => {
      const avgTime = measureRenderTimeWithProviders(
        <div>
          <Button>Test</Button>
          <Input placeholder="Test" />
        </div>
      );
      expect(avgTime).toBeLessThan(RENDER_THRESHOLD);
    });
  });

  describe("Memory Performance", () => {
    it("Component mounting/unmounting doesn't leak memory", () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Render and unmount components multiple times
      for (let i = 0; i < 1000; i++) {
        const { unmount } = renderWithProviders(
          <div>
            <Button>Test {i}</Button>
            <Input value={`test-${i}`} onChange={() => {}} />
          </div>
        );
        unmount();
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory increase after 1000 renders: ${memoryIncrease / 1024 / 1024}MB`
      );

      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB threshold
    });
  });

  describe("Large Lists Performance", () => {
    it("Large list of components renders within threshold", () => {
      const LargeList = () => (
        <div>
          {Array.from({ length: 1000 }, (_, i) => (
            <Button key={i} size="sm">
              Item {i}
            </Button>
          ))}
        </div>
      );

      const avgTime = measureRenderTimeWithProviders(<LargeList />);
      expect(avgTime).toBeLessThan(1000); // 1 second for 1000 items
    });
  });

  describe("Interactive Performance", () => {
    it("Button interactions perform within threshold", () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0);
        return (
          <Button onClick={() => setCount(count + 1)}>Click me {count}</Button>
        );
      };

      const { getByRole } = renderWithProviders(<TestComponent />);
      const button = getByRole("button");

      const times: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        button.click();
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((acc, time) => acc + time, 0) / times.length;
      expect(avgTime).toBeLessThan(10); // 10ms threshold for click handling
    });
  });
});
