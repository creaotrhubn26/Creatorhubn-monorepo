-- Give the existing owner-scoped TROLL demo and the canonical demo exact,
-- Kartverket-resolvable public addresses. Creative labels are intentionally
-- preserved: these addresses identify safe scout/production bases, not a
-- claim that permits or access to the depicted place are already approved.
--
-- The frontend currently reads rich project data from legacy_compat_store,
-- while normalized location operations reference casting_locations. Both
-- representations must therefore be repaired in the same idempotent migration.

WITH address_map(name_pattern, address, coordinates) AS (
  VALUES
    ('%DOVREFJELL%', 'Hjerkinnhusvegen 33, 2661 Hjerkinn', jsonb_build_object('lat', 62.221369748446335, 'lng', 9.545710818134248)),
    ('%LÆRDALSTUNNELEN%', 'Håbakken 1, 6887 Lærdal', jsonb_build_object('lat', 61.064242216726036, 'lng', 7.5091786081532)),
    ('%STATSMINISTERENS KONTOR%', 'Einar Gerhardsens plass 2, 0179 Oslo', jsonb_build_object('lat', 59.915476919195164, 'lng', 10.747079786878066)),
    ('%ØSTERDALEN GÅRD%', 'Vollanveien 221, 2512 Kvikne', jsonb_build_object('lat', 62.5697007013055, 'lng', 10.303484139189125)),
    ('%TOBIAS HYTTE%', 'Synnfjellvegen 1879, 2880 Nord-Torpa', jsonb_build_object('lat', 61.12914119732402, 'lng', 9.871904330537753))
)
UPDATE casting_locations AS location
SET
  address = address_map.address,
  coordinates = address_map.coordinates,
  updated_at = NOW()
FROM address_map
WHERE location.project_id IN ('troll-project-2026', 'troll-1780071501773')
  AND UPPER(location.name) LIKE address_map.name_pattern
  AND (
    location.address IS DISTINCT FROM address_map.address
    OR location.coordinates IS DISTINCT FROM address_map.coordinates
  );

WITH rewritten_projects AS (
  SELECT
    compat.store_key,
    jsonb_agg(
      CASE
        WHEN UPPER(location.value->>'name') LIKE '%DOVREFJELL%'
          THEN location.value || jsonb_build_object(
            'address', 'Hjerkinnhusvegen 33, 2661 Hjerkinn',
            'coordinates', jsonb_build_object('lat', 62.221369748446335, 'lng', 9.545710818134248)
          )
        WHEN UPPER(location.value->>'name') LIKE '%LÆRDALSTUNNELEN%'
          THEN location.value || jsonb_build_object(
            'address', 'Håbakken 1, 6887 Lærdal',
            'coordinates', jsonb_build_object('lat', 61.064242216726036, 'lng', 7.5091786081532)
          )
        WHEN UPPER(location.value->>'name') LIKE '%STATSMINISTERENS KONTOR%'
          THEN location.value || jsonb_build_object(
            'address', 'Einar Gerhardsens plass 2, 0179 Oslo',
            'coordinates', jsonb_build_object('lat', 59.915476919195164, 'lng', 10.747079786878066)
          )
        WHEN UPPER(location.value->>'name') LIKE '%ØSTERDALEN GÅRD%'
          THEN location.value || jsonb_build_object(
            'address', 'Vollanveien 221, 2512 Kvikne',
            'coordinates', jsonb_build_object('lat', 62.5697007013055, 'lng', 10.303484139189125)
          )
        WHEN UPPER(location.value->>'name') LIKE '%TOBIAS HYTTE%'
          THEN location.value || jsonb_build_object(
            'address', 'Synnfjellvegen 1879, 2880 Nord-Torpa',
            'coordinates', jsonb_build_object('lat', 61.12914119732402, 'lng', 9.871904330537753)
          )
        ELSE location.value
      END
      ORDER BY location.ordinality
    ) AS locations
  FROM legacy_compat_store AS compat
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(compat.store_value->'locations') = 'array'
        THEN compat.store_value->'locations'
      ELSE '[]'::jsonb
    END
  )
    WITH ORDINALITY AS location(value, ordinality)
  WHERE compat.store_key IN (
    'casting:project:troll-project-2026',
    'casting:project:troll-1780071501773'
  )
  GROUP BY compat.store_key
)
UPDATE legacy_compat_store AS compat
SET
  store_value = jsonb_set(compat.store_value, '{locations}', rewritten.locations, true),
  updated_at = NOW()
FROM rewritten_projects AS rewritten
WHERE compat.store_key = rewritten.store_key
  AND compat.store_value->'locations' IS DISTINCT FROM rewritten.locations;
