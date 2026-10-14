import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },          // e.g. "HOODIE-BLK-M"
    size: { type: String, required: true },         // S, M, L, XL
    color: { type: String, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    priceOverride: { type: Number, min: 0 },        // optional, else basePrice
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true }, // hoodies, jeans...
    gender: { type: String, enum: ["men", "women", "unisex", "kids"], default: "unisex" },
    brand: { type: String, trim: true },
    basePrice: { type: Number, required: true, min: 0 },
    images: [{ url: String, publicId: String }],            // Cloudinary
    variants: {
      type: [variantSchema],
      validate: (v) => v.length > 0,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A SKU must be unique across the whole catalog
productSchema.index({ "variants.sku": 1 }, { unique: true });
// Search + filter support
productSchema.index({ name: "text", description: "text", brand: "text" });
productSchema.index({ category: 1, basePrice: 1 });

export default mongoose.model("Product", productSchema);