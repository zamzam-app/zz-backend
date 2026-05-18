import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

// 1. Load .env manually
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('Error: MONGO_URI is not defined in .env');
  process.exit(1);
}

// 2. Define PricingOption and Product schema for migration
interface IPricingOption {
  quantityValue: number;
  quantityUnit: string;
  amount: number;
  currency: string;
}

interface IProduct extends mongoose.Document {
  name: string;
  price?: number;
  pricing?: IPricingOption[];
  isDeleted: boolean;
}

const PricingOptionSchema = new mongoose.Schema(
  {
    quantityValue: { type: Number, required: true },
    quantityUnit: { type: String, required: true, default: 'kg', lowercase: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR', uppercase: true },
  },
  { _id: false },
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number },
    pricing: { type: [PricingOptionSchema] },
    isDeleted: { type: Boolean, default: false },
  },
  { collection: 'products', timestamps: true },
);

const ProductModel = mongoose.model<IProduct>('ProductMigration', ProductSchema);

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri as string);
    console.log('Connected successfully!');

    // Find products where 'pricing' is missing or has length 0, but 'price' exists.
    const query = {
      $or: [
        { pricing: { $exists: false } },
        { pricing: null },
        { pricing: { $size: 0 } },
      ],
      price: { $exists: true, $ne: null },
    };

    const products = await ProductModel.find(query);
    console.log(`Found ${products.length} products that require pricing migration.`);

    let successCount = 0;
    for (const product of products) {
      const legacyPrice = product.price;
      if (legacyPrice !== undefined && legacyPrice !== null) {
        console.log(`Migrating product: "${product.name}" (ID: ${product._id}, legacy price: ${legacyPrice})`);
        
        product.pricing = [
          {
            quantityValue: 1,
            quantityUnit: 'kg',
            amount: legacyPrice,
            currency: 'INR',
          },
        ];

        // Save the updated product document
        await product.save();
        successCount++;
      }
    }

    console.log(`\nMigration completed successfully!`);
    console.log(`Total products checked: ${products.length}`);
    console.log(`Successfully migrated: ${successCount}`);
  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    console.log('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runMigration();
