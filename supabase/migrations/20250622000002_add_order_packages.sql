-- Globus Livraison — Ajout du support « multi-colis »
-- Une commande peut désormais contenir plusieurs colis, stockés dans une
-- colonne JSON `packages`. Chaque élément a la forme :
-- {
--   "description": "...",
--   "weight": 1.5,
--   "dimensions": "30×20×15 cm",
--   "fragile": false,
--   "perishable": false,
--   "declared_value_chf": null,
--   "extra_insurance": false,
--   "goods_photo_url": null
-- }

-- 1) Nouvelle colonne (liste vide par défaut)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS packages JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Reprise des données existantes : on transforme l'ancien colis unique
--    (champs à plat) en un tableau d'un seul colis, uniquement pour les
--    commandes qui n'ont pas encore de colis.
UPDATE orders
SET packages = jsonb_build_array(
  jsonb_build_object(
    'description', '',
    'weight', COALESCE(weight, 0),
    'dimensions', dimensions,
    'fragile', COALESCE(fragile, false),
    'perishable', COALESCE(perishable, false),
    'declared_value_chf', declared_value_chf,
    'extra_insurance', COALESCE(extra_insurance, false),
    'goods_photo_url', goods_photo_url
  )
)
WHERE packages = '[]'::jsonb
  AND (
    weight IS NOT NULL
    OR dimensions IS NOT NULL
    OR fragile = true
    OR perishable = true
    OR declared_value_chf IS NOT NULL
    OR goods_photo_url IS NOT NULL
  );
