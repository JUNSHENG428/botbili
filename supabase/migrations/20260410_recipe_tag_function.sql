CREATE OR REPLACE FUNCTION get_popular_recipe_tags(p_limit int DEFAULT 30)
RETURNS TABLE(tag text, count bigint) AS $$
  SELECT unnest(tags) AS tag, COUNT(*) AS count
  FROM recipes
  WHERE visibility = 'public' AND status = 'published'
  GROUP BY tag
  ORDER BY count DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
