// Minimal Express app with EJS templates, SQLite DB, file uploads
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DB = require('./db');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(session({
  secret: 'novasoft-secret',
  resave: false,
  saveUninitialized: true
}));

// Middleware to expose admin status
app.use((req, res, next) => {
  res.locals.isAdmin = !!req.session.isAdmin;
  next();
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

/* Routes */

// Home page: show animated banner and list of games
app.get('/', (req, res, next) => {
  try {
    const games = DB.getAllGames();
    const categories = DB.getAllCategories();
    res.render('index', { games, categories });
  } catch (err) {
    next(err);
  }
});

// Game detail / download gating page
app.get('/game/:id', (req, res, next) => {
  try {
    const game = DB.getGameById(req.params.id);
    if (!game) return res.status(404).send('Game not found');
    // Example screenshots to show (use provided URLs + uploaded image)
    const screenshots = [
      'https://i.postimg.cc/ZqkNg8Ry/IMG-20260622-WA0431.jpg',
      'https://i.postimg.cc/7ZzGg5VG/IMG-20260622-WA0432.jpg',
      'https://i.postimg.cc/m2vh2bsc/IMG-20260605-WA0506.jpg'
    ];
    res.render('game', { game, screenshots });
  } catch (err) {
    next(err);
  }
});

// Attempt download: if game requires password, check code; else redirect to download link
app.get('/download/:id', (req, res, next) => {
  try {
    const game = DB.getGameById(req.params.id);
    if (!game) return res.status(404).send('Game not found');
    if (!game.requires_password) {
      return res.redirect(game.download_link);
    }
    const code = req.query.code;
    if (!code) {
      // show page to input code (render same game page instructing to enter)
      return res.redirect(`/game/${game.id}`);
    }
    const valid = DB.checkCodeForGame(game.id, code);
    if (valid) {
      return res.redirect(game.download_link);
    } else {
      return res.status(403).send('Access code invalid. Use the WhatsApp button to request access.');
    }
  } catch (err) {
    next(err);
  }
});

/* Admin pages */

// Login page
app.get('/admin', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res, next) => {
  try {
    const pw = req.body.password || '';
    if (pw === ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      return res.redirect('/admin/dashboard');
    } else {
      return res.render('admin/login', { error: 'Wrong password' });
    }
  } catch (err) {
    next(err);
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

function adminOnly(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin');
}

app.get('/admin/dashboard', adminOnly, (req, res, next) => {
  try {
    const games = DB.getAllGames();
    res.render('admin/dashboard', { games });
  } catch (err) { next(err); }
});

// Categories management
app.get('/admin/categories', adminOnly, (req, res, next) => {
  try { const categories = DB.getAllCategories(); res.render('admin/categories', { categories }); } catch (err) { next(err); }
});

app.post('/admin/categories', adminOnly, (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (name) DB.createCategory(name);
    res.redirect('/admin/categories');
  } catch (err) { next(err); }
});

// Games management (list + add form)
app.get('/admin/games', adminOnly, (req, res, next) => {
  try {
    const games = DB.getAllGames();
    const categories = DB.getAllCategories();
    res.render('admin/games', { games, categories, message: null });
  } catch (err) { next(err); }
});

app.post('/admin/games', adminOnly, upload.single('image'), (req, res, next) => {
  try {
    const { name, description, download_link, category_id, requires_password } = req.body;
    const image_path = req.file ? '/uploads/' + req.file.filename : (req.body.image_url || '');
    DB.createGame({
      name: name || 'Untitled',
      description: description || '',
      image: image_path,
      download_link: download_link || '#',
      category_id: category_id || null,
      requires_password: requires_password ? 1 : 0
    });
    res.redirect('/admin/games');
  } catch (err) { next(err); }
});

// Codes management
app.get('/admin/codes', adminOnly, (req, res, next) => {
  try {
    const codes = DB.getAllCodesWithGames();
    const games = DB.getAllGames();
    res.render('admin/codes', { codes, games });
  } catch (err) { next(err); }
});

// Generate a new code for a game
app.post('/admin/codes', adminOnly, (req, res, next) => {
  try {
    const { game_id } = req.body;
    const code = nanoid(8).toUpperCase();
    DB.createCode(game_id, code);
    res.redirect('/admin/codes');
  } catch (err) { next(err); }
});

// Admin: delete code
app.post('/admin/codes/delete', adminOnly, (req, res, next) => {
  try { const { id } = req.body; DB.deleteCode(id); res.redirect('/admin/codes'); } catch (err) { next(err); }
});

// Simple error handler to show debug info in development
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (req.xhr || req.headers.accept.indexOf('json') !== -1) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
  res.status(500).send(`<h1>Server error</h1><pre>${err.stack}</pre><p>Check server console for details.</p>`);
});

app.listen(PORT, () => console.log(`Novasoft app running on http://localhost:${PORT}`));
