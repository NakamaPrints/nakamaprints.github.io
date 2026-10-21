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
  // The rest of the Gen 1 set (2026-10-21): clips cut from the user's anime Pokédex videos, text transcribed from them.
  6: {
    species: 'Flame Pokémon', types: ['Fire', 'Flying'], height: '1.7 m', weight: '90.5 kg',
    text: 'Charizard, the Flame Pokémon. Charizard\'s powerful flame can melt absolutely anything.',
  },
  16: {
    species: 'Tiny Bird Pokémon', types: ['Normal', 'Flying'], height: '0.3 m', weight: '1.8 kg',
    text: 'Pidgey is a Flying Pokémon. Among all the Flying Pokémon, it is the gentlest and easiest to capture. ' +
          'A perfect target for the beginning Pokémon trainer to test his Pokémon\'s skills.',
  },
  25: {
    species: 'Mouse Pokémon', types: ['Electric'], height: '0.4 m', weight: '6.0 kg',
    text: 'Pikachu, the Mouse Pokémon, and the evolved form of Pichu. ' +
          'Pikachu\'s tail is sometimes struck by lightning as it raises it to check its surroundings.',
  },
  39: {
    species: 'Balloon Pokémon', types: ['Normal', 'Fairy'], height: '0.5 m', weight: '5.5 kg',
    text: 'Jigglypuff, a Balloon Pokémon. It has large, friendly eyes, and it sings a pleasant song.',
  },
  52: {
    species: 'Scratch Cat Pokémon', types: ['Normal'], height: '0.4 m', weight: '4.2 kg',
    text: 'Meowth, the Scratch Cat Pokémon. Meowth loves to roam at night to gather coins and other objects that sparkle, ' +
          'but it spends most of the daylight hours sleeping.',
  },
  54: {
    species: 'Duck Pokémon', types: ['Water'], height: '0.8 m', weight: '19.6 kg',
    text: 'Psyduck, the Duck Pokémon. Psyduck suffers frequent headaches and can exhibit mysterious attacks ' +
          'when they become especially intense.',
  },
  94: {
    species: 'Shadow Pokémon', types: ['Ghost', 'Poison'], height: '1.5 m', weight: '40.5 kg',
    text: 'Gengar, the Shadow Pokémon, a Ghost and Poison type. Gengar can pass through dimensions and appear almost anywhere. ' +
          'Since Gengar absorbs any warmth around it, the temperature suddenly drops wherever it appears.',
  },
  123: {
    species: 'Mantis Pokémon', types: ['Bug', 'Flying'], height: '1.5 m', weight: '56.0 kg',
    text: 'Scyther, a Mantis Pokémon. Its claws are sharp as swords, and it is a powerful flyer. ' +
          'This Pokémon is rarely seen by humans and almost never captured.',
  },
  128: {
    species: 'Wild Bull Pokémon', types: ['Normal'], height: '1.4 m', weight: '88.4 kg',
    text: 'Tauros, a wild bull Pokémon. When whipping itself with its three tails, its tackle is a powerful destructive force.',
  },
  130: {
    species: 'Atrocious Pokémon', types: ['Water', 'Flying'], height: '6.5 m', weight: '235.0 kg',
    text: 'Gyarados. This Pokémon has a vicious temperament, so use extreme caution. ' +
          'Its fangs can crush stones and its scales are harder than steel.',
  },
  131: {
    species: 'Transport Pokémon', types: ['Water', 'Ice'], height: '2.5 m', weight: '220.0 kg',
    text: 'Lapras, the Transport Pokémon. Lapras enjoys carrying people on its back, and it understands what people are saying.',
  },
  133: {
    species: 'Evolution Pokémon', types: ['Normal'], height: '0.3 m', weight: '6.5 kg',
    text: 'Eevee, the Evolution Pokémon. It has the potential to evolve into any one of three different Pokémon.',
  },
  143: {
    species: 'Sleeping Pokémon', types: ['Normal'], height: '2.1 m', weight: '460.0 kg',
    text: 'Snorlax is the heaviest species of all known Pokémon, with some weighing more than 1,000 pounds.',
  },
  144: {
    species: 'Freeze Pokémon', types: ['Ice', 'Flying'], height: '1.7 m', weight: '55.4 kg',
    text: 'Articuno, the Freeze Pokémon. This legendary Pokémon, with wings like thin sheets of ice, ' +
          'is believed to possess the ability to freeze water vapor and create snow.',
  },
  145: {
    species: 'Electric Pokémon', types: ['Electric', 'Flying'], height: '1.6 m', weight: '52.6 kg',
    text: 'Zapdos, the Electric Pokémon. Zapdos has both electric and flying elements, ' +
          'and the flapping of its wings can create lightning.',
  },
  146: {
    species: 'Flame Pokémon', types: ['Fire', 'Flying'], height: '2.0 m', weight: '60.0 kg',
    text: 'Moltres, a one-of-a-kind legendary flame Pokémon. So powerful, its fire dust can bring early spring to wintery lands.',
  },
  // 150 Mewtwo: waiting for a clip that has its Pokédex entry
};
