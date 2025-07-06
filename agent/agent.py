import os
import json
import random
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

# The path for the agent's persistent state, mounted from the Docker volume
STATE_FILE = "/data/agent_state.json"

# The agent's "brain" is encapsulated in the RLAgent class


class RLAgent:
    def __init__(self, learning_rate=0.1, discount_factor=0.9, exploration_rate=1.0):
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.exploration_rate = exploration_rate
        self.q_table = {}

    def get_q_value(self, state, action):
        """Get Q-value for a state-action pair."""
        return self.q_table.get(state, {}).get(str(action), 0.0)

    def compute_value_from_q_values(self, state):
        """Compute the best value from Q-values for a given state."""
        q_values = self.q_table.get(state, {})
        if not q_values:
            return 0.0
        return max(q_values.values())

    def compute_action_from_q_values(self, state):
        """Compute the best action from Q-values for a given state."""
        q_values = self.q_table.get(state, {})
        if not q_values:
            return None
        # q_values keys are strings, convert back to int
        action = max(q_values, key=q_values.get)
        return int(action)

    def choose_action(self, state, valid_moves):
        """Choose an action using an epsilon-greedy strategy."""
        if not valid_moves:
            return None

        if random.random() < self.exploration_rate:
            return random.choice(valid_moves)
        else:
            q_values = {
                move: self.get_q_value(state, move) for move in valid_moves
            }
            max_q = max(q_values.values())
            # Get all actions with max_q value and choose one randomly
            best_moves = [move for move, q in q_values.items() if q == max_q]
            return random.choice(best_moves)

    def update(self, state, action, next_state, reward):
        """Update the Q-table using the Bellman equation."""
        old_value = self.get_q_value(state, action)
        next_max = self.compute_value_from_q_values(next_state)

        new_value = old_value + self.learning_rate * (
            reward + self.discount_factor * next_max - old_value
        )

        if state not in self.q_table:
            self.q_table[state] = {}
        self.q_table[state][str(action)] = new_value


agent = RLAgent()


def load_state():
    """Loads the Q-table from the state file if it exists."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            agent.q_table = json.load(f)
        app.logger.info(f"Loaded agent state from {STATE_FILE}")
    else:
        app.logger.info("No state file found. Starting with a new Q-table.")


def save_state():
    """Saves the Q-table to the state file."""
    with open(STATE_FILE, "w") as f:
        json.dump(agent.q_table, f, indent=2)
    app.logger.info(f"Saved agent state to {STATE_FILE}")


@app.route("/health")
def health_check():
    """A simple health check endpoint."""
    return "OK", 200


@app.route("/get_move", methods=["POST"])
def get_move():
    """
    Determines the agent's move.
    For this skeleton, it just chooses a random valid move.
    """
    load_state()  # Load the latest Q-table
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400
    board = data.get("board")
    player = data.get("player")

    app.logger.info(f"Received request for player {player} with board: {board}")

    if not board:
        return jsonify({"error": "Board state not provided"}), 400

    # Find all available (empty) squares
    valid_moves = [i for i, square in enumerate(board) if square is None]

    if not valid_moves:
        return jsonify({"error": "No valid moves available"}), 400

    # Use the agent to choose a move
    state_key = "".join(str(s) if s is not None else "-" for s in board)
    move = agent.choose_action(state_key, valid_moves)

    return jsonify({"move": move})

@app.route("/learn", methods=["POST"])
def learn():
    """Receives the outcome of a move and triggers the agent's learning process."""
    load_state()  # Load the latest Q-table
    data = request.get_json()
    app.logger.info(f"Received learning data: {data}")
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400

    state = data.get("state")
    action = data.get("action")
    next_state = data.get("next_state")
    reward = data.get("reward")
    done = data.get("done")

    if any(v is None for v in [state, action, next_state, reward, done]):
        return jsonify({"error": "Missing required fields"}), 400

    app.logger.info(f"Learning from state: {state}, action: {action}, reward: {reward}")

    agent.update(state, action, next_state, reward)

    # Decay exploration rate
    if done and agent.exploration_rate > 0.01:
        agent.exploration_rate *= 0.99

    save_state()

    return jsonify({"status": "ok"})


@app.route("/")
def index():
    """A simple endpoint to view the agent's Q-table."""
    return jsonify(agent.q_table)


if __name__ == "__main__":
    load_state()
    app.run(host="0.0.0.0", port=5000)

