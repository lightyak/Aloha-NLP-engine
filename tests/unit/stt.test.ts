import { describe, it, expect } from 'vitest';
import { MockSTTProvider } from '../../src/providers/stt/mockSTTProvider.js';
import { GeminiSTTProvider } from '../../src/providers/stt/geminiSTTProvider.js';
import { ConfigurationError } from '../../src/utils/errors.js';

describe('STT Providers', () => {
  describe('MockSTTProvider', () => {
    it('returns default mock transcription', async () => {
      const provider = new MockSTTProvider();
      expect(provider.name).toBe('mock-stt');

      const buffer = Buffer.from('mock audio content');
      const result = await provider.transcribe(buffer, 'audio/wav', 'te');

      expect(result.text).toBeDefined();
      expect(result.language).toBe('te');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('allows registering custom canned transcriptions by size key', async () => {
      const provider = new MockSTTProvider();
      const customBuffer = Buffer.from('custom-audio-bytes');
      const sizeKey = `size:${customBuffer.length}`;

      provider.setCannedTranscription(sizeKey, {
        text: 'నమస్కారం, ఇది కొండపల్లి బొమ్మ',
        language: 'te',
        confidence: 0.95,
        duration: 3.5,
      });

      const result = await provider.transcribe(customBuffer, 'audio/wav');
      expect(result.text).toBe('నమస్కారం, ఇది కొండపల్లి బొమ్మ');
      expect(result.language).toBe('te');
    });
  });

  describe('GeminiSTTProvider', () => {
    it('throws ConfigurationError when instantiated without API key', () => {
      expect(() => new GeminiSTTProvider('')).toThrow(ConfigurationError);
    });
  });
});
