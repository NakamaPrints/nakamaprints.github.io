// Talks to the Nakama Pokédex database. Everyone is a Supabase account: the first time someone
// adds a Pokémon, a silent guest account is created on this phone (no form, no password). Saving
// links Google to that same account; signing in on another phone brings any guest Pokémon along.
(function () {
  let client = null;

  function sb() {
    if (!client) {
      const { supabaseUrl, supabaseKey } = window.NAKAMA_CONFIG;
      client = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nakama-pokedex', detectSessionInUrl: true },
      });
    }
    return client;
  }

  // A small JSON value kept in this browser.
  const store = key => ({
    get() { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} },
    clear() { try { localStorage.removeItem(key); } catch (e) {} },
  });
  const authState = store('np-auth'); // what we were doing when we left for Google: { intent, ticket }

  // The current session; with create=true, quietly makes a guest account if there is none.
  async function session(create) {
    const { data } = await sb().auth.getSession();
    if (data.session) return data.session;
    if (!create) return null;
    const { data: made, error } = await sb().auth.signInAnonymously();
    if (error) throw error;
    return made.session;
  }

  async function rpc(fn, args) {
    const { data, error } = await sb().rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  // Errors Supabase puts on the address when it sends someone back from Google.
  function redirectError() {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const code = q.get('error_code') || h.get('error_code') || q.get('error') || h.get('error');
    if (!code) return null;
    return { code, text: (q.get('error_description') || h.get('error_description') || '').replace(/\+/g, ' ') };
  }

  async function googleSignIn(returnTo, intent) {
    const s = await session(false);
    // A guest's Pokémon on this phone move into the account once signed in.
    const ticket = s && s.user.is_anonymous ? await rpc('merge_ticket').catch(() => null) : null;
    authState.set({ intent, ticket });
    const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo } });
    if (error) { authState.clear(); throw error; }
  }

  window.NakamaDB = {
    session,
    // What Pokémon is on this card, and is it free? Never claims anything.
    async peek(code) {
      await session(false);
      return rpc('peek_card', { p_code: code });
    },
    // Add the card's Pokémon to this phone's trainer (first one to add it wins).
    async claim(code) {
      await session(true);
      return rpc('claim_card', { p_code: code });
    },
    // How many different Pokémon this phone has, out of all of them.
    async progress() {
      const [list, mine] = await Promise.all([this.pokemonList(), this.myCollection()]);
      const have = new Set(mine.map(c => c.dex));
      return { found: list.filter(p => have.has(p.dex)).length, total: list.length };
    },
    // The last card this phone scanned but didn't add yet: { code, dex, name }, so My Pokédex can offer it.
    pending: store('np-pending'),
    async trainer() {
      await session(true);
      return rpc('my_trainer');
    },
    async setName(name) {
      const s = await session(true);
      const { error } = await sb().from('trainers').update({ name }).eq('user_id', s.user.id);
      if (error) throw error;
    },
    async pokemonList() {
      const { data, error } = await sb().from('pokemon').select('dex,name,rare,available').order('dex');
      if (error) throw error;
      return data;
    },
    async myCollection() {
      if (!(await session(false))) return [];
      const { data, error } = await sb().from('collection').select('dex,obtained_at').order('obtained_at');
      if (error) throw error;
      return data;
    },
    async hasPokedex() {
      return !!(await session(false));
    },

    // ---- saving and signing in
    // The signed-in user, fresh from the server (null when there's none).
    async user() {
      if (!(await session(false))) return null;
      const { data } = await sb().auth.getUser();
      return data.user || null;
    },
    isSaved(user) { return !!user && !user.is_anonymous; },
    // First name from Google, for the "What's your name?" box.
    googleName(user) {
      const g = ((user && user.identities) || []).find(i => i.provider === 'google');
      const d = (g && g.identity_data) || (user && user.user_metadata) || {};
      return String(d.given_name || d.full_name || d.name || '').trim().split(/\s+/)[0].slice(0, 12);
    },
    // Save this guest Pokédex with Google. Google is linked to the same account, so the Pokémon and
    // trainer code stay. Leaves the page for Google; finishAuth() picks up on the way back.
    async saveWithGoogle(returnTo) {
      const s = await session(false);
      if (!s || !s.user.is_anonymous) return googleSignIn(returnTo, 'signin');
      authState.set({ intent: 'save' });
      const { error } = await sb().auth.linkIdentity({ provider: 'google', options: { redirectTo: returnTo } });
      if (error) { authState.clear(); throw error; }
    },
    // Sign in to a Pokédex saved earlier (a new phone, or the home-screen app).
    signInWithGoogle(returnTo) { return googleSignIn(returnTo, 'signin'); },
    // Call on page load. After a trip to Google it returns what happened:
    //   { kind: 'saved' }                  the guest Pokédex is now saved to Google
    //   { kind: 'signedin', moved, dex }   signed in; `moved` guest Pokémon came along
    //   { kind: 'redirecting' }            that Google account already had a Pokédex: signing in to it
    //   { kind: 'error', code, text }      cancelled or failed
    // and null when the page wasn't opened by a sign-in.
    async finishAuth(returnTo) {
      const state = authState.get();
      const err = redirectError();
      if (!state && !err) return null;
      if (err) {
        // Saving to a Google account that already has a Pokédex: sign in to it and bring these Pokémon along.
        if (state && state.intent === 'save' && /identity_already_exists|already linked|already exists/i.test(err.code + ' ' + err.text)) {
          await googleSignIn(returnTo, 'signin');
          return { kind: 'redirecting' };
        }
        authState.clear();
        return { kind: 'error', ...err };
      }
      authState.clear();
      const user = await this.user();
      if (!this.isSaved(user)) return null; // went to Google but came back without signing in
      if (state.intent === 'save') return { kind: 'saved', user };
      const merged = state.ticket ? await rpc('finish_merge', { p_ticket: state.ticket }).catch(() => null) : null;
      return { kind: 'signedin', user, moved: merged ? merged.moved : 0, dex: merged ? merged.dex : [] };
    },
  };
})();
