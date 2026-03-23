const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const supabase       = require('../db/database');

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

        // Check by google_id first
        let { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('google_id', googleId)
          .maybeSingle();

        if (!user) {
          // Check by email
          let { data: existingByEmail } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (existingByEmail) {
            // Link Google to existing account
            await supabase
              .from('users')
              .update({ google_id: googleId, avatar, provider: 'google', updated_at: new Date().toISOString() })
              .eq('id', existingByEmail.id);

            const { data: updated } = await supabase.from('users').select('*').eq('id', existingByEmail.id).single();
            user = updated;
          } else {
            // Create new user
            const id = uuidv4();
            await supabase.from('users').insert({ id, name, email, google_id: googleId, avatar, provider: 'google' });
            const { data: created } = await supabase.from('users').select('*').eq('id', id).single();
            user = created;
          }
        } else {
          // Update avatar
          await supabase
            .from('users')
            .update({ avatar, updated_at: new Date().toISOString() })
            .eq('id', user.id);
          const { data: refreshed } = await supabase.from('users').select('*').eq('id', user.id).single();
          user = refreshed;
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
  const { data: user } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  done(null, user || false);
});

module.exports = passport;
