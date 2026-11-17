// Add these entries to your bruise database in script.js.
// Keep the PNG files inside a folder named "bruises" beside index.html.

const bruiseDatabase = [
  { src: "bruises/bruise_01_soft_red.png", type: "soft-red", size: [150, 230] },
  { src: "bruises/bruise_02_large_purple.png", type: "large-purple", size: [260, 430] },
  { src: "bruises/bruise_03_large_purple_warm.png", type: "large-warm-purple", size: [250, 410] },
  { src: "bruises/bruise_04_faint_scattered.png", type: "faint-scattered", size: [130, 210] },
  { src: "bruises/bruise_05_small_knee.png", type: "small-purple", size: [100, 145] }
];

// Example: choose one at random
function getRandomBruise() {
  return bruiseDatabase[Math.floor(Math.random() * bruiseDatabase.length)];
}
