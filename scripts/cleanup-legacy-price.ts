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

// 2. Define Product schema/model for cleanup
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number },
  },
  { collection: 'products', strict: false },
);

const ProductModel = mongoose.model('ProductCleanup', ProductSchema);

async function runCleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri as string);
    console.log('Connected successfully!');

    // Find count of products that still have the legacy price field
    const legacyCount = await ProductModel.countDocuments({
      price: { $exists: true, $ne: null },
    });
    console.log(`Found ${legacyCount} products with a legacy 'price' field to be cleaned up.`);

    if (legacyCount === 0) {
      console.log('No legacy prices to clean up.');
      return;
    }

    // Perform $unset on all products
    const result = await ProductModel.updateMany(
      { price: { $exists: true } },
      { $unset: { price: '' } },
    );

    console.log(`\nCleanup completed successfully!`);
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
  } catch (error) {
    console.error('Cleanup failed with error:', error);
  } finally {
    console.log('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runCleanup();
