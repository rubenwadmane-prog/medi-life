const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email    = profile.emails?.[0]?.value;
        const name     = profile.displayName || profile.name?.givenName || 'User';
        const avatar   = profile.photos?.[0]?.value;

        if (!email) return done(new Error('No email from Google profile'), null);

        // Check if user already exists by google_id
        let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);

        if (!user) {
          // Check by email (might have signed up with email/password before)
          user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

          if (user) {
            // Link Google to existing account
            db.prepare(`
              UPDATE users SET google_id = ?, avatar = ?, provider = 'google', updated_at = datetime('now')
              WHERE id = ?
            `).run(googleId, avatar, user.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
          } else {
            // Create new user
            const id = uuidv4();
            db.prepare(`
              INSERT INTO users (id, name, email, google_id, avatar, provider)
              VALUES (?, ?, ?, ?, ?, 'google')
            `).run(id, name, email, googleId, avatar);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
          }
        } else {
          // Update avatar in case it changed
          db.prepare(`UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(avatar, user.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Minimal serialize — we use JWTs so session is only used during OAuth flow
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user || false);
});

module.exports = passport;
