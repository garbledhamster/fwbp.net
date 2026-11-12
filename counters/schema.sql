CREATE TABLE IF NOT EXISTS visitors (
  visitor_key TEXT PRIMARY KEY NOT NULL,
  clicked_hotdog INTEGER NOT NULL CHECK (clicked_hotdog IN (0, 1))
);

CREATE TABLE IF NOT EXISTS totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  anglers INTEGER NOT NULL DEFAULT 0,
  hotdog INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO totals (id) VALUES (1);

CREATE TRIGGER IF NOT EXISTS count_visitor
AFTER INSERT ON visitors
BEGIN
  UPDATE totals SET anglers = anglers + 1, hotdog = hotdog + NEW.clicked_hotdog WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS count_hotdog_click
AFTER UPDATE OF clicked_hotdog ON visitors
WHEN OLD.clicked_hotdog = 0 AND NEW.clicked_hotdog = 1
BEGIN
  UPDATE totals SET hotdog = hotdog + 1 WHERE id = 1;
END;
