import Cart from '../models/cart.js';
import Order from '../models/order.js';
import Product from '../models/Product.js';

export const createOrderFromCart = async (req, res) => {
    try {
        const userId = req.user._id; // Attached via auth middleware
        const { shippingAddress, shippingPrice = 0, stripePaymentIntentId } = req.body;

        if (!shippingAddress) {
            return res.status(400).json({ success: false, message: 'Shipping address is required' });
        }

        // 1. Find the user's cart and populate/fetch items
        const cart = await Cart.findOne({ user: userId });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        let calculatedItemsPrice = 0;
        const validatedOrderItems = [];
        const stockUpdates = [];

        // 2. Iterate through each cart item to validate live stock and pricing from Product schema
        for (const cartItem of cart.items) {
            const productDoc = await Product.findOne({
                _id: cartItem.product,
                "variants.sku": cartItem.sku
            });

            if (!productDoc) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Product or variant no longer available for SKU: ${cartItem.sku}` 
                });
            }

            const variant = productDoc.variants.find(v => v.sku === cartItem.sku);

            if (!variant) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Variant with SKU ${cartItem.sku} does not exist anymore` 
                });
            }

            // Check variant-level stock availability
            if (variant.stock < cartItem.qty) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${productDoc.name} (${variant.color} / ${variant.size}). Only ${variant.stock} left.` 
                });
            }

            // Determine unit price: respect priceOverride if present, otherwise use basePrice
            const unitPrice = (variant.priceOverride !== undefined && variant.priceOverride !== null)
                ? variant.priceOverride 
                : productDoc.basePrice;

            calculatedItemsPrice += unitPrice * cartItem.qty;

            // Grab the primary preview image URL
            const imageUrl = productDoc.images && productDoc.images.length > 0 
                ? productDoc.images[0].url 
                : '';

            // Build snapshot matching your orderItemSchema
            validatedOrderItems.push({
                product: productDoc._id,
                name: productDoc.name,
                image: imageUrl,
                sku: variant.sku,
                size: variant.size,
                color: variant.color,
                price: unitPrice, // Locked-in server price at purchase time
                qty: cartItem.qty
            });

            // Prepare atomic inventory decrement query
            stockUpdates.push({
                updateOne: {
                    filter: { _id: productDoc._id, "variants.sku": cartItem.sku },
                    update: { $inc: { "variants.$.stock": -cartItem.qty } }
                }
            });
        }

        // 3. Compute final order pricing
        const totalPrice = calculatedItemsPrice + Number(shippingPrice);

        // 4. Create and persist the Order document
        const newOrder = new Order({
            user: userId,
            items: validatedOrderItems,
            shippingAddress,
            itemsPrice: calculatedItemsPrice,
            shippingPrice: Number(shippingPrice),
            totalPrice,
            stripePaymentIntentId: stripePaymentIntentId || undefined,
            paymentStatus: 'pending',
            orderStatus: 'processing'
        });

        const savedOrder = await newOrder.save();

        // 5. Atomically decrement variant stock levels across products
        await Product.bulkWrite(stockUpdates);

        // 6. Clear out the user's cart now that the order has been successfully placed
        cart.items = [];
        await cart.save();

        res.status(201).json({
            success: true,
            message: 'Checkout successful, order created, and cart cleared',
            order: savedOrder
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Duplicate payment intent. Order already exists.' 
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error during cart checkout',
            error: error.message
        });
    }
};