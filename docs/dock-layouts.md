# Dock layouts

Small Dock occupies one water hex and admits two Small/Medium vessels. Large Deep-Water Dock occupies two adjacent water hexes, with a base on the first and a tip on the second. It admits three Small/Medium vessels or one exclusive Large/ExtraLarge vessel.

Each part has six independently painted views on a transparent atlas. The renderer uses the same source-pixel scale on both axes and positions each part at its own tile center. The mesh is exactly one pointy-top regular hex. No endpoint fitting, anisotropic stretching, sprite rotation, or mirroring occurs. This also prevents dock imagery extending beyond its assigned water tile.

The eighteen tile meshes are cached and share one source texture. Normal zoom fading and docking reservations are preserved. Large-ship hull/turning safety and adjacent-cell exclusivity remain unchanged.
