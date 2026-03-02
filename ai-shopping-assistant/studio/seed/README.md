# Seed Data

This directory contains sample data for the ecommerce starter kit.

## Contents

`data.tar.gz` includes:

- **5 categories**: Alpine Skiing, Cross-Country, Ice Sports, Snow Sports, Team Gear
- **4 brands**: Summit Pro, Nordic Edge, IceForge, Powder Republic
- **6 colors**: Gold Medal, Silver Streak, Bronze Blaze, Alpine White, Podium Blue, Avalanche Red
- **5 sizes**: XS, S, M, L, XL
- **6 materials**: Gore-Tex Pro, Thinsulate, Carbon Fiber Composite, Polycarbonate, Merino Wool, Kevlar Blend
- **24 products**: Spread across all categories with descriptions, prices, and color variants with AI-generated images
- **1 agent config**: Olympic-themed shopping assistant system prompt
- **1 agent context**: Default content access configuration (all product-related types)

## Importing

From the project root:

```bash
cd studio && npx sanity dataset import seed/data.tar.gz production
```

## Notes

- All products include variant structures with color and size references to demonstrate the full schema.
- Products with multiple color variants each have their own AI-generated product image.
- The agent config uses a playful Winter Olympics persona for the AI shopping assistant.
