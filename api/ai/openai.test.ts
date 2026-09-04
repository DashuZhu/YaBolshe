import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./openai";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("local transcription routing", () => {
  it("uses fast Whisper before Parakeet", async () => {
    process.env.PARAKEET_URL = "http://parakeet";
    process.env.WHISPER_URL = "http://whisper";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          duration: 3.4,
          segments: [{ start: 0, end: 3.4, text: "Добрый день.", avg_logprob: -0.1 }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio(Buffer.from("audio"), "session.mp3");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("http://whisper/transcribe");
    expect(result.model).toBe("faster-whisper:small:int8");
    expect(result.segments[0].text).toBe("Добрый день.");
  });

  it("falls back to Parakeet when Whisper fails", async () => {
    process.env.PARAKEET_URL = "http://parakeet";
    process.env.WHISPER_URL = "http://whisper";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not ready", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            duration: 2,
            segments: [{ start: 0, end: 2, text: "Резерв работает.", avg_logprob: -0.2 }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio(Buffer.from("audio"), "session.m4a");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("http://parakeet/transcribe");
    expect(result.model).toContain("parakeet:");
    expect(result.segments[0].text).toBe("Резерв работает.");
  });
});
