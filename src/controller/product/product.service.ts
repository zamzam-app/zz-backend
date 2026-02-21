import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './entities/product.entity';
import { FindAllProductsResult } from './interfaces/query-product.interface';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      const createdProduct = new this.productModel(createProductDto);
      return await createdProduct.save();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to create product',
      );
    }
  }

  async findAll(query: QueryProductDto): Promise<FindAllProductsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      const [result] = await this.productModel
        .aggregate<{
          data: Product[];
          totalCount: [{ count: number }];
        }>([
          { $match: { isDeleted: false } },
          {
            $facet: {
              data: [{ $skip: skip }, { $limit: limit }],
              totalCount: [{ $count: 'count' }],
            },
          },
        ])
        .exec();

      const total = result.totalCount[0]?.count ?? 0;

      return {
        data: result.data,
        meta: {
          total,
          currentPage: page,
          hasPrevPage: page > 1,
          hasNextPage: page * limit < total,
          limit,
        },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to fetch products',
      );
    }
  }

  async findOne(id: string): Promise<Product> {
    try {
      const [product] = await this.productModel
        .aggregate<Product>([
          { $match: { _id: new Types.ObjectId(id), isDeleted: false } },
          { $limit: 1 },
        ])
        .exec();
      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return product;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to fetch product',
      );
    }
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    try {
      const existingProduct = await this.productModel
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), isDeleted: false },
          [{ $set: updateProductDto as Record<string, unknown> }],
          { new: true, updatePipeline: true },
        )
        .exec();

      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return existingProduct;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to update product',
      );
    }
  }

  async remove(id: string): Promise<Product> {
    try {
      const deletedProduct = await this.productModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true },
          { new: true },
        )
        .exec();

      if (!deletedProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return deletedProduct;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Failed to remove product',
      );
    }
  }
}
