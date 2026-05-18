import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto, PricingOptionDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './entities/product.entity';
import { FindAllProductsResult } from './interfaces/query-product.interface';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  private normalizePricing(
    pricing?: Partial<PricingOptionDto>[],
  ): PricingOptionDto[] | undefined {
    if (!pricing) return undefined;
    return pricing.map((item) => {
      const quantityValue = Number(item.quantityValue);
      const amount = Number(item.amount);

      if (isNaN(quantityValue) || quantityValue <= 0) {
        throw new HttpException('quantityValue must be greater than 0', 400);
      }
      if (isNaN(amount) || amount < 0) {
        throw new HttpException(
          'amount must be greater than or equal to 0',
          400,
        );
      }

      return {
        quantityValue,
        quantityUnit:
          typeof item.quantityUnit === 'string' && item.quantityUnit.trim()
            ? item.quantityUnit.toLowerCase().trim()
            : 'kg',
        amount,
        currency:
          typeof item.currency === 'string' && item.currency.trim()
            ? item.currency.toUpperCase().trim()
            : 'INR',
      };
    });
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      if (createProductDto.pricing) {
        createProductDto.pricing = this.normalizePricing(
          createProductDto.pricing,
        ) as PricingOptionDto[];
      }
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
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.categoryId) {
        matchStage.categoryList = query.categoryId;
      }

      const dataPipeline = limit ? [{ $skip: skip }, { $limit: limit }] : [];

      const [result] = await this.productModel
        .aggregate<{
          data: Product[];
          totalCount: [{ count: number }];
        }>([
          { $match: matchStage },
          {
            $facet: {
              data: dataPipeline,
              totalCount: [{ $count: 'count' }],
            },
          },
        ])
        .exec();

      const total = result.totalCount[0]?.count ?? 0;
      const effectiveLimit = limit ?? total;

      return {
        data: result.data,
        meta: {
          total,
          currentPage: limit ? page : 1,
          hasPrevPage: limit ? page > 1 : false,
          hasNextPage: limit ? page * limit < total : false,
          limit: effectiveLimit,
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
      if (updateProductDto.pricing) {
        updateProductDto.pricing = this.normalizePricing(
          updateProductDto.pricing,
        ) as PricingOptionDto[];
      }
      const existingProduct = await this.productModel
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), isDeleted: false },
          { $set: updateProductDto },
          { new: true, runValidators: true },
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
