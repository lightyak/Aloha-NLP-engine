import type { IntentDefinition } from './types.js';
import defaultIntentsJson from '../dialogue/intents.json' with { type: 'json' };

export class IntentRegistry {
  private intents: Map<string, IntentDefinition> = new Map();
  private version: string = '1.0.0';

  constructor(initialIntents?: { version: string; intents: IntentDefinition[] }) {
    const data = initialIntents || (defaultIntentsJson as { version: string; intents: IntentDefinition[] });
    this.version = data.version;
    for (const intent of data.intents) {
      this.intents.set(intent.name, intent);
    }
  }

  public getIntents(): IntentDefinition[] {
    return Array.from(this.intents.values());
  }

  public getIntent(name: string): IntentDefinition | undefined {
    return this.intents.get(name);
  }

  public registerIntent(intent: IntentDefinition): void {
    this.intents.set(intent.name, intent);
  }

  public removeIntent(name: string): boolean {
    return this.intents.delete(name);
  }

  public toPromptDescription(): string {
    return this.getIntents()
      .map((i) => `- ${i.name}: ${i.description} (Examples: "${i.examples.slice(0, 2).join('", "')}")`)
      .join('\n');
  }

  public getVersion(): string {
    return this.version;
  }
}

export const defaultIntentRegistry = new IntentRegistry();
