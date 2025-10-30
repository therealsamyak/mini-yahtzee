import { NUM_DICE, NUM_REROLLS, calculateMultisetScore } from "./utils.js"
import type { MultisetState } from "./utils.js"
import { readFileSync, writeFileSync, existsSync } from 'fs'

// Type definitions
// For example: [2, 1, 0, 1, 1, 0] means two 1s, one 2, one 4, one 5
type Action = number[] // Array of die VALUES to reroll (not indices)

// Utility functions
const generateRandomMultiset = (): MultisetState => {
  const multiset: MultisetState = [0, 0, 0, 0, 0, 0]
  for (let i = 0; i < NUM_DICE; i++) {
    const value = Math.floor(Math.random() * 6) + 1
    const index = value - 1
    if (index >= 0 && index < multiset.length) {
      multiset[index]!++
    }
  }
  return multiset
}

const multisetToString = (multiset: MultisetState): string => {
  const parts = multiset
    .map((count, index) => (count > 0 ? `${index + 1}:${count}` : null))
    .filter((part): part is string => part !== null)
  return `{${parts.join(", ")}}`
}

const actionToString = (action: Action): string =>
  action.length === 0
    ? "No reroll"
    : `Reroll dice with values: ${action.join(", ")}`

// Generate all possible multiset states using stars and bars
const generateAllMultisetStates = (): MultisetState[] => {
  const states: MultisetState[] = []

  // Use stars and bars: C(6+5-1, 5) = C(10, 5) = 252
  const generateRecursive = (
    current: number[],
    remaining: number,
    startValue: number,
  ) => {
    if (remaining === 0) {
      states.push([...current] as MultisetState)
      return
    }

    for (let value = startValue; value <= 6; value++) {
      for (let count = 1; count <= remaining; count++) {
        current[value - 1] = count
        generateRecursive(current, remaining - count, value + 1)
        current[value - 1] = 0
      }
    }
  }

  generateRecursive([0, 0, 0, 0, 0, 0], NUM_DICE, 1)
  return states
}

// Generate all possible actions for a given multiset state
const generateAllActions = (multiset: MultisetState): Action[] => {
  const actions: Action[] = []

  // Generate all subsets of dice values present in the multiset
  const presentValues = multiset
    .map((count, index) => (count > 0 ? index + 1 : null))
    .filter((value): value is number => value !== null)

  // Generate all subsets of present values
  for (let mask = 0; mask < 1 << presentValues.length; mask++) {
    const action: Action = []
    presentValues.forEach((value, i) => {
      if (mask & (1 << i)) {
        action.push(value)
      }
    })
    actions.push(action)
  }

  return actions
}

// Calculate transition probability from multiset s to multiset s' given action a
const calculateTransitionProbability = (
  fromMultiset: MultisetState,
  toMultiset: MultisetState,
  action: Action,
): number => {
  // Count how many dice are being rerolled
  const rerollCount = action.reduce((sum, value) => {
    const index = value - 1
    return (
      sum +
      (index >= 0 && index < fromMultiset.length ? fromMultiset[index]! : 0)
    )
  }, 0)

  if (rerollCount === 0) {
    // No reroll - states must be identical
    return fromMultiset.every((count, i) => count === toMultiset[i]) ? 1.0 : 0.0
  }

  // Calculate probability using multinomial distribution
  // P(s'|s, a) = (1/6)^rerollCount * multinomial_coefficient * ways_to_achieve_s'

  // First, check if the transition is possible
  const newMultiset: MultisetState = [...fromMultiset]
  action.forEach((value) => {
    const index = value - 1
    if (index >= 0 && index < newMultiset.length) {
      newMultiset[index]! -= fromMultiset[index]!
    }
  })

  // Check if toMultiset can be achieved by adding rerollCount dice
  if (!toMultiset.every((count, i) => count >= newMultiset[i]!)) {
    return 0.0 // Impossible transition
  }

  // Calculate multinomial coefficient
  const addedDice = toMultiset.map((count, i) => count - newMultiset[i]!)

  // Multinomial coefficient: rerollCount! / (addedDice[0]! * addedDice[1]! * ... * addedDice[5]!)
  let multinomialCoeff = 1
  let remaining = rerollCount
  addedDice.forEach((count) => {
    for (let j = 1; j <= count; j++) {
      multinomialCoeff = (multinomialCoeff * remaining) / j
      remaining--
    }
  })

  return multinomialCoeff * Math.pow(1.0 / 6.0, rerollCount)
}

// Policy cache management
const POLICY_CACHE_FILE = `src/multiset-policy-${NUM_DICE}dice-${NUM_REROLLS}rerolls.json`

const loadPolicyFromCache = (): Map<string, { value: number; action: Action }> | null => {
  if (existsSync(POLICY_CACHE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(POLICY_CACHE_FILE, 'utf8'))
      return new Map(data)
    } catch (error) {
      console.log('Failed to load cached policy, recomputing...')
      return null
    }
  }
  return null
}

const savePolicyToCache = (policy: Map<string, { value: number; action: Action }>): void => {
  const data = Array.from(policy.entries())
  writeFileSync(POLICY_CACHE_FILE, JSON.stringify(data, null, 2))
  console.log(`Policy cached to ${POLICY_CACHE_FILE}`)
}

// Value iteration algorithm
const valueIteration = (): Map<string, { value: number; action: Action }> => {
  // Try to load from cache first
  const cachedPolicy = loadPolicyFromCache()
  if (cachedPolicy) {
    console.log(`Loaded cached policy from ${POLICY_CACHE_FILE}`)
    return cachedPolicy
  }

  console.log('Computing optimal strategy (multiset)...')
  const allStates = generateAllMultisetStates()
  const totalStates = allStates.length // Should be 252

  // Initialize value function V(s, t) and policy π(s, t)
  const valueFunction = new Map<string, number>()
  const policy = new Map<string, { value: number; action: Action }>()

  // Step 1: Initialize V(s, 0) = R(s) for all states
  process.stdout.write(
    `Computing optimal strategy (multiset), found ${totalStates} states`,
  )
  for (let i = 0; i < allStates.length; i++) {
    const state = allStates[i]!
    const stateKey = multisetToString(state)
    valueFunction.set(stateKey, calculateMultisetScore(state))

    // Update progress
    process.stdout.write(
      `\rComputing optimal strategy (multiset), processed ${i + 1}/${totalStates} states`,
    )
  }

  // Step 2-4: Iterate backwards from t = NUM_REROLLS down to 1
  for (let t = NUM_REROLLS; t >= 1; t--) {
    const newValueFunction = new Map<string, number>()
    const newPolicy = new Map<string, { value: number; action: Action }>()

    for (let i = 0; i < allStates.length; i++) {
      const state = allStates[i]!
      const stateKey = multisetToString(state)
      let maxQValue = -Infinity
      let bestAction: Action = []

      // Generate actions for this specific state
      const allActions = generateAllActions(state)

      // Calculate Q(s, a, t) for all actions
      for (const action of allActions) {
        let qValue = 0.0

        // Q(s, a, t) = Σ P(s'|s, a) * V(s', t-1)
        for (const nextState of allStates) {
          const nextStateKey = multisetToString(nextState)
          const transitionProb = calculateTransitionProbability(
            state,
            nextState,
            action,
          )
          const nextValue = valueFunction.get(nextStateKey) || 0
          qValue += transitionProb * nextValue
        }

        if (qValue > maxQValue) {
          maxQValue = qValue
          bestAction = action
        }
      }

      newValueFunction.set(stateKey, maxQValue)
      newPolicy.set(stateKey, { value: maxQValue, action: bestAction })

      // Update progress
      process.stdout.write(
        `\rComputing optimal strategy (multiset), processed ${i + 1}/${totalStates} states (iteration ${NUM_REROLLS - t + 1}/${NUM_REROLLS})`,
      )
    }

    // Update value function for next iteration
    for (const [key, value] of newValueFunction) {
      valueFunction.set(key, value)
    }

    // Store policy for this time step
    for (const [key, value] of newPolicy) {
      policy.set(key, value)
    }
  }

  // Clear the progress line and show completion
  process.stdout.write(
    `\rComputing optimal strategy (multiset), found ${totalStates} states - completed!\n`,
  )
  
  // Save policy to cache
  savePolicyToCache(policy)
  return policy
}

// Convert multiset to dice array for display
const multisetToDiceArray = (multiset: MultisetState): number[] => {
  return multiset.flatMap((count, index) => Array(count).fill(index + 1))
}

// Convert dice array to multiset
const diceArrayToMultiset = (dice: number[]): MultisetState => {
  const multiset: MultisetState = [0, 0, 0, 0, 0, 0]
  dice.forEach((value) => {
    const index = value - 1
    if (index >= 0 && index < multiset.length) {
      multiset[index]!++
    }
  })
  return multiset
}

// Main game simulation
export const simulateGame = (): void => {
  console.log(`=== Yahtzee Game Simulation (Multiset) ===`)
  console.log(`Number of dice: ${NUM_DICE}`)
  console.log(`Number of rerolls: ${NUM_REROLLS}`)
  console.log(`State space: 252 states (vs 7,776 for colored dice)`)
  console.log()

  // Generate random starting position
  let currentMultiset = generateRandomMultiset()
  let rerollsRemaining = NUM_REROLLS

  // Pre-compute optimal policy
  const policy = valueIteration()
  console.log()

  // Simulate game turns
  for (let turn = 0; turn <= NUM_REROLLS; turn++) {
    const stateKey = multisetToString(currentMultiset)
    const currentScore = calculateMultisetScore(currentMultiset)
    const diceArray = multisetToDiceArray(currentMultiset)

    console.log(`=== Turn ${turn + 1} ===`)
    console.log(`Hand: [${diceArray.join(", ")}] (${stateKey})`)
    console.log(`Score: ${currentScore}`)
    console.log(`Rerolls left: ${rerollsRemaining}`)

    if (rerollsRemaining === 0) {
      console.log(`Final hand: [${diceArray.join(", ")}] (${stateKey})`)
      console.log(`Final score: ${currentScore}`)
      console.log(`Rerolls left: ${rerollsRemaining}`)
      break
    }

    const optimalDecision = policy.get(stateKey)

    if (!optimalDecision) {
      console.log("Error: No optimal action found for current state")
      break
    }

    console.log(`Optimal action: ${actionToString(optimalDecision.action)}`)
    console.log(`Q-value: ${optimalDecision.value.toFixed(10)}`)

    if (optimalDecision.action.length === 0) {
      console.log("No reroll chosen - keeping current dice\n")
      rerollsRemaining = 0
      continue
    }

    // Simulate reroll
    const newMultiset: MultisetState = [...currentMultiset]
    optimalDecision.action.forEach((value) => {
      const index = value - 1
      if (index >= 0 && index < newMultiset.length) {
        newMultiset[index] = 0 // Remove all dice of this value
      }
    })

    // Add new random dice
    const remainingDice = optimalDecision.action.reduce((sum, value) => {
      const index = value - 1
      return (
        sum +
        (index >= 0 && index < currentMultiset.length
          ? currentMultiset[index]!
          : 0)
      )
    }, 0)

    for (let i = 0; i < remainingDice; i++) {
      const newValue = Math.floor(Math.random() * 6) + 1
      const index = newValue - 1
      if (index >= 0 && index < newMultiset.length) {
        newMultiset[index]!++
      }
    }

    const newDiceArray = multisetToDiceArray(newMultiset)
    console.log(
      `New hand after reroll: [${newDiceArray.join(", ")}] (${multisetToString(newMultiset)})`,
    )
    console.log()

    currentMultiset = newMultiset
    rerollsRemaining--
  }
}
