// Camelot code → readable musical key, so we don't have to run keyfinder twice
// (it already gives us the Camelot code directly).
const CAMELOT_TO_KEY = {
  "8B": "C", "3B": "D♭", "10B": "D", "5B": "E♭", "12B": "E",
  "7B": "F", "2B": "G♭", "9B": "G", "4B": "A♭", "11B": "A",
  "6B": "B♭", "1B": "B",
  "5A": "Cm", "12A": "C♯m", "7A": "Dm", "2A": "E♭m", "9A": "Em",
  "4A": "Fm", "11A": "F♯m", "6A": "Gm", "1A": "A♭m", "8A": "Am",
  "3A": "B♭m", "10A": "Bm",
};

module.exports = { CAMELOT_TO_KEY };
