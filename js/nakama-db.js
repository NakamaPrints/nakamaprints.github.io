// Talks to the Nakama Pokédex database. Everyone is a Supabase account: the first time someone
// registers a Pokémon, a silent guest account is created on this phone (no form, no password).
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
    // Register the card's Pokémon to this phone's trainer (first scan wins).
    async claim(code) {
      await session(true);
      return rpc('claim_card', { p_code: code });
    },
    async trainer() {
      await session(true);
      return rpc('my_trainer');
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
  };
})();
