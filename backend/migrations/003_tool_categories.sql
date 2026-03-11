-- Migration 003: Tool categories (Store) – bảng danh mục + khóa ngoại trên tools.
-- Khi cài đặt Portal, seed sẵn nhiều category phổ biến (tham khảo App Store).

-- 1. Bảng danh mục ứng dụng (Store)
CREATE TABLE IF NOT EXISTS ai_portal.tool_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_categories_slug ON ai_portal.tool_categories(slug);
CREATE INDEX IF NOT EXISTS idx_tool_categories_display_order ON ai_portal.tool_categories(display_order);

-- 2. Thêm cột category_id vào tools (nullable; null = chưa phân loại / "Chung")
ALTER TABLE ai_portal.tools ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES ai_portal.tool_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tools_category_id ON ai_portal.tools(category_id);

-- 3. Seed categories phổ biến (App Store style + Research, Education cho Portal)
INSERT INTO ai_portal.tool_categories (slug, name, display_order) VALUES
  ('general', 'General', 0),
  ('research', 'Research', 10),
  ('education', 'Education', 20),
  ('productivity', 'Productivity', 30),
  ('business', 'Business', 40),
  ('finance', 'Finance', 50),
  ('utilities', 'Utilities', 60),
  ('health-fitness', 'Health & Fitness', 70),
  ('lifestyle', 'Lifestyle', 80),
  ('entertainment', 'Entertainment', 90),
  ('music', 'Music', 100),
  ('photo-video', 'Photo & Video', 110),
  ('social-networking', 'Social Networking', 120),
  ('news', 'News', 130),
  ('travel', 'Travel', 140),
  ('food-drink', 'Food & Drink', 150),
  ('shopping', 'Shopping', 160),
  ('sports', 'Sports', 170),
  ('books', 'Books', 180),
  ('reference', 'Reference', 190),
  ('developer-tools', 'Developer Tools', 200),
  ('graphics-design', 'Graphics & Design', 210),
  ('medical', 'Medical', 220),
  ('navigation', 'Navigation', 230),
  ('weather', 'Weather', 240),
  ('kids', 'Kids', 250),
  ('magazines-newspapers', 'Magazines & Newspapers', 260),
  ('games', 'Games', 300),
  ('games-action', 'Games: Action', 301),
  ('games-adventure', 'Games: Adventure', 302),
  ('games-casual', 'Games: Casual', 303),
  ('games-puzzle', 'Games: Puzzle', 304),
  ('games-strategy', 'Games: Strategy', 305),
  ('games-simulation', 'Games: Simulation', 306),
  ('games-sports', 'Games: Sports', 307),
  ('games-educational', 'Games: Educational', 308)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_order = EXCLUDED.display_order, updated_at = now();
