## 1 turn game of Yahtzee

### System Setup

The player initially rolls 5 dice, then can choose whether to roll any number of the dice or not. After the 2nd roll, the player can choose to roll any number of the dice again or not. Then, the score is finalized.

#### Each dice is 'colored'

$$S = \{ (s_1, s_2, s_3, s_4, s_5) \mid s_i \in \{1, 2, 3, 4, 5\} \}$$

$$N = |S| = 6^{5} = 7776$$

The player action is which dice **number** the player chooses to reroll

$$A = \{ a \subseteq \{1,2,3,4,5\} \}$$

The transition probabilities are

$$P( (s_1', s_2', s_3', s_4', s_5') \mid (s_1, s_2, s_3, s_4, s_5), a) = \prod_{i=1}^{5} P(s'_i \mid s_i, i \in a)$$

Each individual dice probability is

\[
P(s'\_i \mid s_i, i \in a) =
\begin{cases}
\frac{1}{6}, & \text{if } i \in a, \\[6pt]
1, & \text{if } i \notin a \text{ and } s'\_i = s_i, \\[6pt]
0, & \text{if } i \notin a \text{ and } s'\_i \neq s_i.
\end{cases}
\]

<br />
#### No repetition
$$ S = \left\{ \{\{s_1, s_2, s_3, s_4, s_5\}\} \mid s_i \in \{1, 2, 3, 4, 5, 6\} \right\} $$

Where $ \{\{s_1, s_2, s_3, s_4, s_5\}\}$ is a **[multiset](https://en.wikipedia.org/wiki/Multiset)**.

Using ["stars and bars"](<https://en.wikipedia.org/wiki/Stars_and_bars_(combinatorics)>):

$$N_s = \binom{n+k-1}{k} = \binom{6+5-1}{5} = \binom{10}{5} = 252$$

The player action is which dice **values** the player chooses to reroll:
$$A = \{ \text{dice \textbf{values} the player wants to reroll, empty if no rerolling} \}$

ex. if the player has $S = \{1, 2, 3, 4, 5\}$, one possible action could be $A = \{1, 4, 5\}$ or $A = \{\}$ (because the hand is good).

Due to the multiset nature, the transition probability set is way more compliated:

$$P(s' \mid s, a) = \frac{\text{Ways}(s \to s' \mid a)}{6^{|a|}}$$

<br/>
**After further consideration, I will continue with 'colored' approach moving forward.**
<br/>

### Planning / Control

The player has parameter t reroll turns REMAINING. For this problem, we set $t \in {0, 1, 2}$, where $t_0 = 2$

Our value function is

$$V(s, t) = \text{expected maximum score from state s with t rerolls remaining}$$

We terminate with $V(s, 0) = R(s)$, where $R(s)$ is the score of the dice according to Yahtzee.

\[
Q(s, a, t) = \sum\_{s'} P(s' \mid s, a) \, V(s', t-1), s \in S, a \in A, t > 0
\]

Therefore,

\[
V(s, t) = \max\limits\_{a \in A}Q(s, a, t), t > 0
\]

#### Value Iteration

We have a finite horizon ($t$). Because this is finite, we can work backwards from $t = 0, 1, ..., t_{max}$, using the previous calculation in our next one (dynamic programming).

1. For each $s \in S$, calculate $V(s, 0) = R(s)$ $\rightarrow$ initial score of every state

2. For each $s \in S$, for each action $a \in A$, calculate its $Q$.

$$Q(s, a, t) = \sum_{s'} P(s' \mid s, a) \, V(s', t-1)$$

3. Select highest $Q$ from the above. The $a$ corresponding to that $Q$ is our optimal action. Store this to report back at the end.

$$\pi^*(s, t) = \arg\max_{a \in A} Q(s, a, t)$$

4. Store new $V$ in memory (need it for next roll calculation).

$$
V(s, t) = \max\limits_{a \in A}Q(s, a, t)
$$

GitHub link: https://github.com/therealsamyak/mini-yahtzee

<br/>
Notes:
* There is a heuristic associated with every state: **the current player score**. The closer you are to the maximum possible score, the less chances you have of scoring better.

## Citations

- Wikipedia links linked above
- AI Tools (Claude)
