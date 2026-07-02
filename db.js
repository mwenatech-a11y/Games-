// Simple SQLite wrapper using better-sqlite3
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data.sqlite'));

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      download_link TEXT,
      category_id INTEGER,
      requires_password INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER,
      code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
init();

module.exports = {
  getAllGames: () => db.prepare('SELECT * FROM games ORDER BY created_at DESC').all(),
  getGameById: (id) => db.prepare('SELECT * FROM games WHERE id = ?').get(id),
  createGame: ({ name, description, image, download_link, category_id, requires_password }) => {
    return db.prepare(`INSERT INTO games (name, description, image, download_link, category_id, requires_password)
      VALUES (?, ?, ?, ?, ?, ?)`).run(name, description, image, download_link, category_id || null, requires_password ? 1 : 0);
  },
  getAllCategories: () => db.prepare('SELECT * FROM categories ORDER BY name').all(),
  createCategory: (name) => db.prepare('INSERT INTO categories (name) VALUES (?)').run(name),
  createCode: (game_id, code) => db.prepare('INSERT INTO codes (game_id, code) VALUES (?, ?)').run(game_id, code),
  checkCodeForGame: (game_id, code) => {
    const row = db.prepare('SELECT * FROM codes WHERE game_id = ? AND code = ?').get(game_id, code);
    return !!row;
  },
  getAllCodesWithGames: () => db.prepare(`
    SELECT codes.id, codes.code, codes.created_at, games.id AS game_id, games.name AS game_name
    FROM codes LEFT JOIN games ON codes.game_id = games.id
    ORDER BY codes.created_at DESC
  `).all(),
  deleteCode: (id) => db.prepare('DELETE FROM codes WHERE id = ?').run(id)
};
