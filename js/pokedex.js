// Pokédex entries shown when someone taps the Pokédex button.
// Keyed by National Dex number (the same number as the ?c= link).
// Edit `text` to match the voice clip in assets/sfx/dex-<number>.mp3 word for word, if you like.
window.NAKAMA_POKEDEX = {
  1: {
    species: 'Seed Pokémon',
    types: ['Grass', 'Poison'],
    height: '0.7 m',
    weight: '6.9 kg',
    text: 'Bulbasaur, the Seed Pokémon. It is born with a seed on its back. The seed soaks up sunlight and slowly grows along with it.',
  },
  4: {
    species: 'Lizard Pokémon',
    types: ['Fire'],
    height: '0.6 m',
    weight: '8.5 kg',
    text: 'Charmander, the Lizard Pokémon. The flame on the tip of its tail shows how it feels. It burns brighter when Charmander is happy.',
  },
  7: {
    species: 'Tiny Turtle Pokémon',
    types: ['Water'],
    height: '0.5 m',
    weight: '9.0 kg',
    text: 'Squirtle, the Tiny Turtle Pokémon. When it feels danger it hides in its shell, then sprays water from its mouth with great force.',
  },
};
