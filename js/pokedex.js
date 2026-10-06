// Pokédex entries shown when someone taps the Pokédex button.
// Keyed by National Dex number (the same number as the ?c= link).
// `text` matches the voice clip in assets/sfx/dex-<number>.mp3 word for word.
window.NAKAMA_POKEDEX = {
  1: {
    species: 'Seed Pokémon',
    types: ['Grass', 'Poison'],
    height: '0.7 m',
    weight: '6.9 kg',
    text: 'Bulbasaur. It bears the seed of a plant on its back from birth. The seed slowly develops. ' +
          'Researchers are unsure whether to classify Bulbasaur as a plant or animal. ' +
          'Bulbasaur are extremely tough and very difficult to capture in the wild.',
  },
  4: {
    species: 'Lizard Pokémon',
    types: ['Fire'],
    height: '0.6 m',
    weight: '8.5 kg',
    text: 'Charmander. A flame burns on the tip of its tail from birth. ' +
          'It is said that a Charmander dies if its flame ever goes out.',
  },
  7: {
    species: 'Tiny Turtle Pokémon',
    types: ['Water'],
    height: '0.5 m',
    weight: '9.0 kg',
    text: 'Squirtle. This tiny turtle Pokémon draws its long neck into its shell to launch incredible water attacks ' +
          'with amazing range and accuracy. The blasts can be quite powerful.',
  },
};
