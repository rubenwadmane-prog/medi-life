const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');

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

        const db  = getDB();
        const now = new Date().toISOString();

        // Check by google_id first
        let user = await db.collection('users').findOne({ google_id: googleId }, { projection: { _id: 0 } });

        if (!user) {
          const existingByEmail = await db.collection('users').findOne({ email }, { projection: { _id: 0 } });

          if (existingByEmail) {
            // Link Google to existing account
            await db.collection('users').updateOne(
              { id: existingByEmail.id },
              { $set: { google_id: googleId, avatar, provider: 'google', updated_at: now } }
            );
            user = await db.collection('users').findOne({ id: existingByEmail.id }, { projection: { _id: 0 } });
          } else {
            // Create new user
            const id = uuidv4();
            user = { id, name, email, google_id: googleId, avatar, provider: 'google', password: null, created_at: now, updated_at: now };
            await db.collection('users').insertOne(user);
            user = await db.collection('users').findOne({ id }, { projection: { _id: 0 } });
          }
        } else {
          // Update avatar
          await db.collection('users').updateOne(
            { id: user.id },
            { $set: { avatar, updated_at: now } }
          );
          user = await db.collection('users').findOne({ id: user.id }, { projection: { _id: 0 } });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const db   = getDB();
    const user = await db.collection('users').findOne({ id }, { projection: { _id: 0 } });
    done(null, user || false);
  } catch (err) {
    done(err, false);
  }
});

module.exports = passport;
