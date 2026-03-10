import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { Outlet, OutletDocument } from './entities/outlet.entity';
import { QueryOutletDto } from './dto/query-outlet.dto';
import { FindAllOutletsResult } from './interface/query-outlet.interface';
import { OutletByQrTokenResult } from './interface/outlet.interface';
import { generateOutletQrToken } from '../../util/outlet-qr-token.util';
import { Form, FormDocument } from '../forms/entities/form.entity';

@Injectable()
export class OutletService {
  constructor(
    @InjectModel(Outlet.name) private outletModel: Model<OutletDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  async create(createOutletDto: CreateOutletDto): Promise<Outlet> {
    const _id = new Types.ObjectId();
    const qrToken = generateOutletQrToken(_id.toString());
    const createdOutlet = new this.outletModel({
      ...createOutletDto,
      _id,
      qrToken,
    });
    return createdOutlet.save();
  }

  async findAll(query: QueryOutletDto): Promise<FindAllOutletsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit;
      const skip = limit ? (page - 1) * limit : 0;

      const matchStage: Record<string, unknown> = { isDeleted: false };
      if (query.name) {
        matchStage.name = { $regex: query.name, $options: 'i' };
      }
      if (query.outletType) {
        matchStage.outletType = new Types.ObjectId(query.outletType);
      }

      const dataPipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'managerId',
            foreignField: '_id',
            as: 'managerId',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $unwind: {
            path: '$managerId',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'outlettypes',
            localField: 'outletType',
            foreignField: '_id',
            as: 'outletType',
            pipeline: [
              { $match: { isDeleted: false } },
              { $project: { _id: 1, name: 1 } },
            ],
          },
        },
        {
          $unwind: {
            path: '$outletType',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'products',
            let: { menuProductIds: '$menuItems.productId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', { $ifNull: ['$$menuProductIds', []] }],
                  },
                },
              },
              { $project: { _id: 1, name: 1 } },
            ],
            as: '_productsLookup',
          },
        },
        {
          $addFields: {
            menuItems: {
              $map: {
                input: { $ifNull: ['$menuItems', []] },
                as: 'mi',
                in: {
                  $mergeObjects: [
                    '$$mi',
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$_productsLookup',
                            as: 'p',
                            cond: { $eq: ['$$p._id', '$$mi.productId'] },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            _productsLookup: 0,
            'menuItems.productId': 0,
          },
        },
        ...(limit ? [{ $skip: skip }, { $limit: limit }] : []),
      ];

      const [result] = await this.outletModel
        .aggregate<{
          data: Outlet[];
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
        err instanceof Error ? err.message : 'Failed to fetch outlets',
      );
    }
  }

  async findOne(id: string): Promise<Outlet> {
    const outlet = await this.outletModel
      .findOne({ _id: id, isDeleted: false })
      .exec();
    if (!outlet) {
      throw new NotFoundException(`Outlet with ID ${id} not found`);
    }
    return outlet;
  }

  async findByQrToken(qrToken: string): Promise<OutletByQrTokenResult> {
    const outlet = await this.outletModel
      .findOne({ qrToken, isDeleted: false })
      .exec();
    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }
    let form: FormDocument | null = null;
    if (outlet.formId) {
      const formDoc = await this.formModel
        .findById(outlet.formId)
        .populate('questions')
        .exec();
      form = formDoc ?? null;
    }
    return {
      _id: outlet._id.toString(),
      name: outlet.name,
      // Cast to the shared IForm interface; toObject() gives us a plain object.
      form: form
        ? (form.toObject() as unknown as OutletByQrTokenResult['form'])
        : null,
    };
  }

  async update(id: string, updateOutletDto: UpdateOutletDto): Promise<Outlet> {
    const existingOutlet = await this.outletModel
      .findOneAndUpdate({ _id: id, isDeleted: false }, updateOutletDto, {
        new: true,
      })
      .exec();

    if (!existingOutlet) {
      throw new NotFoundException(`Outlet with ID ${id} not found`);
    }
    return existingOutlet;
  }

  async remove(id: string): Promise<Outlet> {
    const deletedOutlet = await this.outletModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true },
      )
      .exec();

    if (!deletedOutlet) {
      throw new NotFoundException(`Outlet with ID ${id} not found`);
    }
    return deletedOutlet;
  }
}
