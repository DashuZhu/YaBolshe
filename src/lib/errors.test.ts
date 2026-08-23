import { describe, expect, it } from "vitest";
import { friendlyApiError } from "./errors";

describe("friendlyApiError", () => {
  it("turns Zod issue JSON into readable Russian text", () => {
    const raw = JSON.stringify([
      { message: "Введите корректную почту" },
      { message: "Введите пароль" },
    ]);
    expect(friendlyApiError(raw)).toBe("Введите корректную почту. Введите пароль");
  });

  it("keeps business errors unchanged", () => {
    expect(friendlyApiError("Неверный email или пароль")).toBe("Неверный email или пароль");
  });

  it("removes duplicate validation messages", () => {
    const raw = JSON.stringify([{ message: "Введите пароль" }, { message: "Введите пароль" }]);
    expect(friendlyApiError(raw)).toBe("Введите пароль");
  });
});
