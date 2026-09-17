import { describe, it, expect, vi, afterEach } from 'vitest';
import { MockSTTProvider } from '../../src/providers/stt/mockSTTProvider.js';
import { GeminiSTTProvider } from '../../src/providers/stt/geminiSTTProvider.js';
import { STTProviderFactory } from '../../src/providers/stt/sttProvider.factory.js';
import { ConfigurationError, ProviderError } from '../../src/utils/errors.js';

// ---------------------------------------------------------------------------
// 1. Mock transcription correctness
// ---------------------------------------------------------------------------
describe('MockSTTProvider', () => {
  it('returns default Telugu transcription', async () => {
    const provider = new MockSTTProvider();
    expect(provider.name).toBe('mock-stt');
    const result = await provider.transcribe(Buffer.from('audio'), 'audio/wav', 'te');
    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
  });

  it('supports canned transcriptions keyed by buffer size', async () => {
    const provider = new MockSTTProvider();
    const buf = Buffer.from('custom-audio');
    provider.setCannedTranscription(`size:${buf.length}`, {
      text: 'నమస్కారం, ఇది కొండపల్లి బొమ్మ',
      language: 'te',
    });
    const result = await provider.transcribe(buf, 'audio/wav');
    expect(result.text).toBe('నమస్కారం, ఇది కొండపల్లి బొమ్మ');
    expect(result.language).toBe('te');
  });

  it('is always healthy', async () => {
    expect(await new MockSTTProvider().isHealthy()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. GeminiSTTProvider configuration
// ---------------------------------------------------------------------------
describe('GeminiSTTProvider', () => {
  it('throws ConfigurationError when instantiated without API key', () => {
    expect(() => new GeminiSTTProvider('')).toThrow(ConfigurationError);
  });

  it('accepts a non-empty API key and model without throwing', () => {
    expect(() => new GeminiSTTProvider('test-key', 'gemini-2.5-flash')).not.toThrow();
  });

  it('isHealthy returns true when key is present', async () => {
    const provider = new GeminiSTTProvider('test-key');
    expect(await provider.isHealthy()).toBe(true);
  });

  it('throws ProviderError on non-OK HTTP response (fetch mocked)', async () => {
    const provider = new GeminiSTTProvider('test-key', 'test-model');
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));
    await expect(provider.transcribe(Buffer.from('data'), 'audio/wav')).rejects.toThrow(ProviderError);
    vi.unstubAllGlobals();
  });

  it('throws ProviderError when Gemini returns empty transcription text', async () => {
    const provider = new GeminiSTTProvider('test-key', 'test-model');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '   ' }] } }] }),
    }));
    await expect(provider.transcribe(Buffer.from('data'), 'audio/wav')).rejects.toThrow(ProviderError);
    vi.unstubAllGlobals();
  });

  it('throws ProviderError when Gemini returns no candidates', async () => {
    const provider = new GeminiSTTProvider('test-key', 'test-model');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ candidates: [] }),
    }));
    await expect(provider.transcribe(Buffer.from('data'), 'audio/wav')).rejects.toThrow(ProviderError);
    vi.unstubAllGlobals();
  });

  it('does NOT set detectedLanguage from a hint — only echoes languageHint', async () => {
    const provider = new GeminiSTTProvider('test-key', 'test-model');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'నమస్కారం' }] } }],
      }),
    }));
    const result = await provider.transcribe(Buffer.from('data'), 'audio/wav', 'te');
    // The provider should NOT set detectedLanguage when Gemini didn't report one
    expect(result.detectedLanguage).toBeUndefined();
    // But it should echo the hint
    expect(result.languageHint).toBe('te');
    // confidence is never manufactured
    expect(result.confidence).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('does not expose API key in error messages', async () => {
    const secretKey = 'super-secret-stt-key';
    const provider = new GeminiSTTProvider(secretKey, 'test-model');
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 400,
      text: async () => `bad request with key=${secretKey}`,
    }));
    try {
      await provider.transcribe(Buffer.from('data'), 'audio/wav');
      expect.fail('should have thrown');
    } catch (e) {
      expect(String(e)).not.toContain(secretKey);
    }
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// 3. STTProviderFactory — test-mode always returns MockSTTProvider
// ---------------------------------------------------------------------------
describe('STTProviderFactory', () => {
  afterEach(() => STTProviderFactory.reset());

  it('returns MockSTTProvider in test mode (NODE_ENV=test)', () => {
    // NODE_ENV is already "test" when Vitest runs
    const provider = STTProviderFactory.getProvider();
    expect(provider.name).toBe('mock-stt');
  });

  it('setProvider / reset work correctly', () => {
    const mock = new MockSTTProvider();
    STTProviderFactory.setProvider(mock);
    expect(STTProviderFactory.getProvider().name).toBe('mock-stt');
    STTProviderFactory.reset();
    expect(STTProviderFactory.getProvider().name).toBe('mock-stt'); // still mock in test env
  });
});
