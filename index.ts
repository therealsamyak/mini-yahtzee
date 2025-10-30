import { simulateGame as simulateColoredDice } from "./src/coloredDice.js"
import { simulateGame as simulateMultiset } from "./src/multiset.js"
import { unlinkSync, existsSync } from 'fs'

// Parse command line arguments
const args = process.argv.slice(2)
const mode = args.includes("--c") ? "colored" : "multiset"
const recompute = args.includes("--recompute")

// Clear cache files if recompute is requested
if (recompute) {
  const coloredCacheFile = 'src/colored-dice-policy-5dice-2rerolls.json'
  const multisetCacheFile = 'src/multiset-policy-5dice-2rerolls.json'
  
  if (existsSync(coloredCacheFile)) {
    unlinkSync(coloredCacheFile)
    console.log('Cleared colored dice policy cache')
  }
  if (existsSync(multisetCacheFile)) {
    unlinkSync(multisetCacheFile)
    console.log('Cleared multiset policy cache')
  }
}

// Run the appropriate simulation
if (mode === "colored") {
  simulateColoredDice()
} else {
  simulateMultiset()
}
