export const WALLET_COLOR_PRESETS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#f472b6",
  "#84cc16",
  "#fb7185",
  "#38bdf8",
];

export function getRandomWalletColor() {
  return WALLET_COLOR_PRESETS[Math.floor(Math.random() * WALLET_COLOR_PRESETS.length)];
}
