import type {
  CraftDefinition,
  CategoryDefinition,
  OntologyData,
} from './types.js';
import defaultOntologyJson from './craftOntology.json' with { type: 'json' };

export class OntologyRegistry {
  private crafts: Map<string, CraftDefinition> = new Map();
  private categories: Map<string, CategoryDefinition> = new Map();
  private materials: OntologyData['materials'] = [];
  private version: string = '1.0.0';

  constructor(initialData?: OntologyData) {
    const data = initialData || (defaultOntologyJson as unknown as OntologyData);
    this.loadOntology(data);
  }

  public loadOntology(data: OntologyData): void {
    this.version = data.version;
    this.crafts.clear();
    this.categories.clear();
    this.materials = [...data.materials];

    for (const cat of data.categories) {
      this.categories.set(cat.id, cat);
    }

    for (const craft of data.crafts) {
      this.crafts.set(craft.id, craft);
    }
  }

  public registerCraft(craft: CraftDefinition): void {
    this.crafts.set(craft.id, craft);
    const category = this.categories.get(craft.category);
    if (category && !category.craftIds.includes(craft.id)) {
      category.craftIds.push(craft.id);
    }
  }

  public registerCategory(category: CategoryDefinition): void {
    this.categories.set(category.id, category);
  }

  public getCraft(id: string): CraftDefinition | undefined {
    return this.crafts.get(id);
  }

  public getCategory(id: string): CategoryDefinition | undefined {
    return this.categories.get(id);
  }

  public getAllCrafts(): CraftDefinition[] {
    return Array.from(this.crafts.values());
  }

  public getAllCategories(): CategoryDefinition[] {
    return Array.from(this.categories.values());
  }

  public getCraftsByCategory(categoryId: string): CraftDefinition[] {
    return this.getAllCrafts().filter((c) => c.category === categoryId);
  }

  /**
   * Search for a craft by matching against ID, name, aliases, or local names (e.g. Telugu, Hindi)
   */
  public findCraft(query: string): CraftDefinition | null {
    if (!query) return null;
    const cleanQuery = query.trim().toLowerCase();

    for (const craft of this.crafts.values()) {
      if (craft.id.toLowerCase() === cleanQuery || craft.name.toLowerCase() === cleanQuery) {
        return craft;
      }
      if (craft.aliases.some((alias) => alias.toLowerCase() === cleanQuery)) {
        return craft;
      }
      for (const localName of Object.values(craft.localNames)) {
        if (localName.toLowerCase() === cleanQuery || cleanQuery.includes(localName.toLowerCase())) {
          return craft;
        }
      }
    }

    // Substring match
    for (const craft of this.crafts.values()) {
      if (
        craft.aliases.some((alias) => cleanQuery.includes(alias.toLowerCase())) ||
        craft.name.toLowerCase().includes(cleanQuery)
      ) {
        return craft;
      }
    }

    return null;
  }

  /**
   * Match category by id, name, or aliases
   */
  public findCategory(query: string): CategoryDefinition | null {
    if (!query) return null;
    const cleanQuery = query.trim().toLowerCase();

    for (const cat of this.categories.values()) {
      if (cat.id.toLowerCase() === cleanQuery || cat.name.toLowerCase() === cleanQuery) {
        return cat;
      }
      if (cat.aliases.some((alias) => alias.toLowerCase() === cleanQuery)) {
        return cat;
      }
    }

    return null;
  }

  /**
   * Match raw material to canonical material name (supports Telugu, Hindi, English)
   */
  public findMaterial(query: string): string | null {
    if (!query) return null;
    const cleanQuery = query.trim().toLowerCase();

    for (const mat of this.materials) {
      if (mat.canonical.toLowerCase() === cleanQuery) {
        return mat.canonical;
      }
      if (mat.aliases.some((alias) => alias.toLowerCase() === cleanQuery)) {
        return mat.canonical;
      }
      if (mat.localNames) {
        for (const localName of Object.values(mat.localNames)) {
          if (localName.toLowerCase() === cleanQuery || cleanQuery.includes(localName.toLowerCase())) {
            return mat.canonical;
          }
        }
      }
    }

    return null;
  }

  public getVersion(): string {
    return this.version;
  }
}

export const defaultOntologyRegistry = new OntologyRegistry();
