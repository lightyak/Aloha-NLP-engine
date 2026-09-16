export interface CraftDefinition {
  id: string;
  name: string;
  category: string;
  region: {
    state: string;
    district?: string;
    giCertified?: boolean;
  };
  aliases: string[];
  localNames: Record<string, string>; // e.g. { "te": "కొండపల్లి బొమ్మలు", "hi": "कोंडापल्ली खिलौने" }
  typicalMaterials: string[];
  techniques: string[];
  relatedCrafts?: string[];
  description?: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  aliases: string[];
  craftIds: string[];
}

export interface OntologyData {
  version: string;
  categories: CategoryDefinition[];
  crafts: CraftDefinition[];
  materials: {
    canonical: string;
    aliases: string[];
    localNames?: Record<string, string>;
  }[];
}
