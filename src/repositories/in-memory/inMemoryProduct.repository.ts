import { randomUUID } from 'node:crypto';
import type {
  IProductRepository,
  Product,
  CreateProductDTO,
  UpdateProductDTO,
} from '../interfaces/product.repository.interface.js';
import { NotFoundError } from '../../utils/errors.js';

export class InMemoryProductRepository implements IProductRepository {
  private products: Map<string, Product> = new Map();

  async create(data: CreateProductDTO): Promise<Product> {
    const now = new Date();
    const product: Product = {
      id: randomUUID(),
      sessionId: data.sessionId,
      artisanId: data.artisanId,
      category: data.category,
      craftType: data.craftType,
      attributes: { ...data.attributes },
      catalog: data.catalog ? { ...data.catalog } : undefined,
      status: data.status || 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.products.set(product.id, product);
    return { ...product };
  }

  async findById(id: string): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product) return null;
    return {
      ...product,
      attributes: { ...product.attributes },
      catalog: product.catalog ? { ...product.catalog } : undefined,
    };
  }

  async findBySessionId(sessionId: string): Promise<Product | null> {
    for (const product of this.products.values()) {
      if (product.sessionId === sessionId) {
        return {
          ...product,
          attributes: { ...product.attributes },
          catalog: product.catalog ? { ...product.catalog } : undefined,
        };
      }
    }
    return null;
  }

  async update(id: string, data: UpdateProductDTO): Promise<Product> {
    const product = this.products.get(id);
    if (!product) {
      throw new NotFoundError(`Product with id ${id}`);
    }

    const updated: Product = {
      ...product,
      category: data.category !== undefined ? data.category : product.category,
      craftType: data.craftType !== undefined ? data.craftType : product.craftType,
      attributes: data.attributes !== undefined ? { ...data.attributes } : product.attributes,
      catalog: data.catalog !== undefined ? { ...data.catalog } : product.catalog,
      status: data.status !== undefined ? data.status : product.status,
      updatedAt: new Date(),
    };

    this.products.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  async list(filter?: { status?: string; artisanId?: string }): Promise<Product[]> {
    let result = Array.from(this.products.values());
    if (filter?.status) {
      result = result.filter((p) => p.status === filter.status);
    }
    if (filter?.artisanId) {
      result = result.filter((p) => p.artisanId === filter.artisanId);
    }
    return result.map((p) => ({
      ...p,
      attributes: { ...p.attributes },
      catalog: p.catalog ? { ...p.catalog } : undefined,
    }));
  }

  clear(): void {
    this.products.clear();
  }
}
