// Global configuration
export const NUM_DICE = 5
export const NUM_REROLLS = 2

// Type definitions
export type DiceState = number[] // Array of dice values [1-6]
export type Action = number[] // Array of dice indices to reroll (0-based)
export type MultisetState = number[] // Array representing counts of each die value [1-6], length = 6

// Scoring function stub - to be implemented by user
export const calculateScore = (dice: DiceState): number => {
  // TODO: Implement scoring logic
  // For now, return a simple sum as placeholder
  return dice.reduce((sum, value) => sum + value, 0)
}

// Multiset scoring function
export const calculateMultisetScore = (multiset: MultisetState): number => {
  // TODO: Implement scoring logic
  // For now, return a simple sum as placeholder
  return multiset.reduce((sum, count, index) => sum + count * (index + 1), 0)
}
