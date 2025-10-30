import { NUM_DICE, NUM_REROLLS, calculateScore } from "./utils.js"
import type { DiceState, Action } from "./utils.js"
import { readFileSync, writeFileSync, existsSync } from 'fs'

// Utility functions
const generateRandomDice = (): DiceState =>
  Array.from({ length: NUM_DICE }, () => Math.floor(Math.random() * 6) + 1)

const stateToString = (dice: DiceState): string => `[${dice.join(", ")}]`

const actionToString = (action: Action): string =>
  action.length === 0
    ? "No reroll"
    : `Reroll dice at positions: ${action.map((i) => i + 1).join(", ")}`

// Generate all possible dice states
const generateAllStates = (): DiceState[] => {
  const states: DiceState[] = []

  const generateRecursive = (current: DiceState, depth: number) => {
    if (depth === NUM_DICE) {
      states.push([...current])
      return
    }

    for (let value = 1; value <= 6; value++) {
      current[depth] = value
      generateRecursive(current, depth + 1)
    }
  }

  generateRecursive(new Array(NUM_DICE), 0)
  return states
}

// Generate all possible actions for a given state
const generateAllActions = (): Action[] => {
  const actions: Action[] = []

  // Generate all subsets of {0, 1, 2, 3, 4}
  for (let mask = 0; mask < 1 << NUM_DICE; mask++) {
    const action: Action = []
    for (let i = 0; i < NUM_DICE; i++) {
      if (mask & (1 << i)) {
        action.push(i)
      }
    }
    actions.push(action)
  }

  return actions
}

// Calculate transition probability from state s to state s' given action a
const calculateTransitionProbability = (
  fromState: DiceState,
  toState: DiceState,
  action: Action,
): number => {
  let probability = 1.0

  for (let i = 0; i < NUM_DICE; i++) {
    if (action.includes(i)) {
      // This die was rerolled, so any value is possible with 1/6 probability
      probability *= 1.0 / 6.0
    } else {
      // This die was not rerolled, so it must stay the same
      if (fromState[i] !== toState[i]) {
        return 0.0 // Impossible transition
      }
      // probability *= 1.0 (stays the same)
    }
  }

  return probability
}

// Policy cache management
const POLICY_CACHE_FILE = `src/colored-dice-policy-${NUM_DICE}dice-${NUM_REROLLS}rerolls.json`

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

  console.log('Computing optimal strategy (colored dice)...')
  const allStates = generateAllStates()
  const allActions = generateAllActions()
  const totalStates = Math.pow(6, NUM_DICE) // 6^NUM_DICE = 6^5 = 7776

  // Initialize value function V(s, t) and policy π(s, t)
  const valueFunction = new Map<string, number>()
  const policy = new Map<string, { value: number; action: Action }>()

  // Step 1: Initialize V(s, 0) = R(s) for all states
  process.stdout.write(
    `Computing optimal strategy (colored dice), found ${totalStates} states`,
  )
  for (let i = 0; i < allStates.length; i++) {
    const state = allStates[i]!
    const stateKey = stateToString(state)
    valueFunction.set(stateKey, calculateScore(state))

    // Update progress
    process.stdout.write(
      `\rComputing optimal strategy (colored dice), processed ${i + 1}/${totalStates} states`,
    )
  }

  // Step 2-4: Iterate backwards from t = NUM_REROLLS down to 1
  for (let t = NUM_REROLLS; t >= 1; t--) {
    const newValueFunction = new Map<string, number>()
    const newPolicy = new Map<string, { value: number; action: Action }>()

    for (let i = 0; i < allStates.length; i++) {
      const state = allStates[i]!
      const stateKey = stateToString(state)
      let maxQValue = -Infinity
      let bestAction: Action = []

      // Calculate Q(s, a, t) for all actions
      for (const action of allActions) {
        let qValue = 0.0

        // Q(s, a, t) = Σ P(s'|s, a) * V(s', t-1)
        for (const nextState of allStates) {
          const nextStateKey = stateToString(nextState)
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
        `\rComputing optimal strategy (colored dice), processed ${i + 1}/${totalStates} states (iteration ${NUM_REROLLS - t + 1}/${NUM_REROLLS})`,
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
    `\rComputing optimal strategy (colored dice), found ${totalStates} states - completed!\n`,
  )
  
  // Save policy to cache
  savePolicyToCache(policy)
  return policy
}

// Main game simulation
export const simulateGame = (): void => {
  console.log(`=== Yahtzee Game Simulation (Colored Dice) ===`)
  console.log(`Number of dice: ${NUM_DICE}`)
  console.log(`Number of rerolls: ${NUM_REROLLS}`)
  console.log(`State space: ${Math.pow(6, NUM_DICE)} states`)
  console.log()

  // Generate random starting position
  let currentDice = generateRandomDice()
  let rerollsRemaining = NUM_REROLLS

  // Pre-compute optimal policy
  const policy = valueIteration()
  console.log()

  // Simulate game turns
  for (let turn = 0; turn <= NUM_REROLLS; turn++) {
    const stateKey = stateToString(currentDice)
    const currentScore = calculateScore(currentDice)

    console.log(`=== Turn ${turn + 1} ===`)
    console.log(`Hand: ${stateKey}`)
    console.log(`Score: ${currentScore}`)
    console.log(`Rerolls left: ${rerollsRemaining}`)

    if (rerollsRemaining === 0) {
      console.log(`Final hand: ${stateKey}`)
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
    const newDice = [...currentDice]
    for (const dieIndex of optimalDecision.action) {
      newDice[dieIndex] = Math.floor(Math.random() * 6) + 1
    }

    console.log(`New hand after reroll: ${stateToString(newDice)}`)
    console.log()

    currentDice = newDice
    rerollsRemaining--
  }
}
