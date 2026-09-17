import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// mỗi testcase chạy trên DOM sạch
afterEach(() => {
  cleanup();
});
