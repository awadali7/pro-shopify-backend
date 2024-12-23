const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// New endpoint to save email
app.post("/api/save-email", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        // Create a new customer in Shopify
        const response = await axios.post(
            `https://proluxuryhome.com/admin/api/2024-10/customers.json`,
            {
                customer: {
                    email,
                    accepts_marketing: true, // Set this to false if you don't want to subscribe them to marketing emails
                },
            },
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );

        // Respond with success
        res.status(201).json({
            message: "Email saved successfully!",
            customer: response.data.customer,
        });
    } catch (error) {
        console.error("Error saving email to Shopify:", error);

        if (error.response) {
            // API error from Shopify
            res.status(error.response.status).json({
                error: error.response.data,
                message: "Failed to save email to Shopify",
            });
        } else if (error.request) {
            // No response received
            res.status(500).json({
                error: "No response received from Shopify",
                message: error.message,
            });
        } else {
            // Other errors
            res.status(500).json({
                error: "Internal server error",
                message: error.message,
            });
        }
    }
});

// Endpoint to fetch products from a specific collection with metafields
app.get("/api/collection-products", async (req, res) => {
    try {
        // Fetch products in the collection
        const productsResponse = await axios.get(
            `https://proluxuryhome.com/admin/api/2024-10/collections/366257340597/products.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );

        const products = productsResponse.data.products;

        // Check if there are any products
        if (!products || products.length === 0) {
            return res
                .status(400)
                .json({ error: "No products found in the collection" });
        }

        // Fetch variants for each product
        const productVariantsPromises = products.map(async (product) => {
            const variantsResponse = await axios.get(
                `https://proluxuryhome.com/admin/api/2024-10/products/${product.id}/variants.json`,
                {
                    headers: {
                        "X-Shopify-Access-Token":
                            process.env.SHOPIFY_ACCESS_TOKEN,
                        "Content-Type": "application/json",
                    },
                }
            );
            return {
                productId: product.id,
                variants: variantsResponse.data.variants,
            };
        });

        const productVariants = await Promise.all(productVariantsPromises);

        // Fetch metafields for the collection
        const metafieldsResponse = await axios.get(
            `https://proluxuryhome.com/admin/api/2024-10/collections/366257340597/metafields.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );

        const metafieldsResponseFiltered =
            metafieldsResponse.data.metafields.map((metafield) => ({
                id: metafield.id,
                title: metafield.key,
                value: metafield.value,
                admin_graphql_api_id: metafield.admin_graphql_api_id,
            }));

        // Merge product data with variants
        const productsWithVariants = products.map((product) => {
            const productVariantData = productVariants.find(
                (pv) => pv.productId === product.id
            );
            return {
                id: product.id,
                title: product.title,
                product_type: product.product_type,
                admin_graphql_api_id: product.admin_graphql_api_id,
                image: product.image,
                variants: productVariantData
                    ? productVariantData.variants.map((variant) => ({
                          id: variant.id,
                          title: variant.title,
                          price: variant.price,
                          sku: variant.sku,
                          admin_graphql_api_id: variant.admin_graphql_api_id,
                      }))
                    : [],
            };
        });

        // Merge metafields and products with variants
        const mergedData = [];
        const maxLength = Math.max(
            metafieldsResponseFiltered.length,
            productsWithVariants.length
        );

        for (let i = 0; i < maxLength; i++) {
            if (i < metafieldsResponseFiltered.length) {
                mergedData.push(metafieldsResponseFiltered[i]);
            }
            if (i < productsWithVariants.length) {
                mergedData.push(productsWithVariants[i]);
            }
        }

        res.json({
            collection: {
                id: "366257340597",
                name: "lucky-draw",
            },
            data: mergedData,
        });
    } catch (error) {
        console.error("Error in /api/collection-products:", error);

        // More detailed error response
        if (error.response) {
            res.status(error.response.status).json({
                error: error.response.data,
                message: "Error fetching collection products",
            });
        } else if (error.request) {
            res.status(500).json({
                error: "No response received",
                message: error.message,
            });
        } else {
            res.status(500).json({
                error: "Error setting up the request",
                message: error.message,
            });
        }
    }
});

// Previous price rules endpoint
app.get("/api/price-rules", async (req, res) => {
    try {
        const response = await axios.get(
            "https://proluxuryhome.com/admin/api/2024-10/price_rules.json",
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Catch-all route to help diagnose routing issues
app.use((req, res) => {
    console.log(`Received ${req.method} request to ${req.path}`);
    res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});

// Export the app for Vercel
module.exports = app;
