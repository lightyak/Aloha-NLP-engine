import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller.js';

export const productsRouter = Router();

productsRouter.post('/validate', ProductsController.validate);
productsRouter.post('/catalog', ProductsController.generateCatalog);
productsRouter.post('/publish', ProductsController.publish);
