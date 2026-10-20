// Talks to the Nakama Pokédex database. Everyone is a Supabase account: the first time someone
// adds a Pokémon, a silent guest account is created on this phone (no form, no password). Saving
// links Google to that same account; signing in on another phone brings any guest Pokémon along.
// Google sign-in happens in Google's own pop-up on this site (see pokedex-page.js), which hands us
// an ID token; there is no redirect through the database's address.
(function () {
  let client = null;

  function sb() {
    if (!client) {
      const { supabaseUrl, supabaseKey } = window.NAKAMA_CONFIG;
      client = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nakama-pokedex' },
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
  const mergeTicket = store('np-merge'); // a guest's ticket, until a sign-in moves its Pokémon across

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
    // Use a Google ID token (from Google's sign-in pop-up) for this phone's Pokédex:
    //   a guest:  link Google to the same account, so the Pokémon and trainer code stay -> { kind: 'saved' }
    //             but if that Google account already has a Pokédex, sign in to it and move the
    //             guest's Pokémon across                                    -> { kind: 'signedin', moved }
    //   no one / someone else: sign in to that Google account's Pokédex    -> { kind: 'signedin', moved: 0 }
    // `nonce` is the raw value whose SHA-256 was given to Google.
    async google(token, nonce) {
      const s = await session(false);
      if (s && s.user.is_anonymous) {
        // Get the merge ticket first (a failed link can drop the guest session) and keep it until a
        // sign-in uses it, so the guest's Pokémon still come along if it takes a second try.
        const ticket = await rpc('merge_ticket').catch(() => null);
        if (ticket) mergeTicket.set(ticket);
        const { error } = await sb().auth.linkIdentity({ provider: 'google', token, nonce });
        if (!error) { mergeTicket.clear(); return { kind: 'saved', user: await this.user() }; }
        if (!/identity_already_exists|already linked|already exists/i.test(`${error.code} ${error.message}`)) {
          if (!(await session(false))) await sb().auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
          throw error;
        }
      }
      const { error } = await sb().auth.signInWithIdToken({ provider: 'google', token, nonce });
      if (error) throw error;
      const ticket = mergeTicket.get();
      mergeTicket.clear();
      const merged = ticket ? await rpc('finish_merge', { p_ticket: ticket }).catch(() => null) : null;
      return { kind: 'signedin', user: await this.user(), moved: merged ? merged.moved : 0 };
    },
  };
})();
