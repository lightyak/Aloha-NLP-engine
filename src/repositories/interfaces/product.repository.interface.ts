export interface CatalogData {
  title: string;
  shortDescription?: string;
  detailedDescription?: string;
  tags: string[];
  searchKeywords: string[];
}

export interface Product {
  id: string;
  sessionId?: string;
  artisanId?: string;
  category?: string;
  craftType?: string;
  attributes: Record<string, unknown>;
  catalog?: CatalogData;
  status: 'draft' | 'validated' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDTO {
  sessionId?: string;
  artisanId?: string;
  category?: string;
  craftType?: string;
  attributes: Record<string, unknown>;
  catalog?: CatalogData;
  status?: 'draft' | 'validated' | 'published';
}

export interface UpdateProductDTO {
  category?: string;
  craftType?: string;
  attributes?: Record<string, unknown>;
  catalog?: CatalogData;
  status?: 'draft' | 'validated' | 'published';
}

export interface IProductRepository {
  create(data: CreateProductDTO): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findBySessionId(sessionId: string): Promise<Product | null>;
  update(id: string, data: UpdateProductDTO): Promise<Product>;
  delete(id: string): Promise<boolean>;
  list(filter?: { status?: string; artisanId?: string }): Promise<Product[]>;
}
