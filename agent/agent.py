from collections import defaultdict
import os
import json
import random
from flask import Flask, request, jsonify, g
import time
import logging

app = Flask(__name__)

@app.before_request
def log_request_info():
    g.start_time = time.time()
    app.logger.info(f"Incoming request to endpoint: '{request.endpoint}'")

@app.after_request
def log_response_info(response):
    if hasattr(g, 'start_time'):
        duration = time.time() - g.start_time
        app.logger.info(f"Request to endpoint '{request.endpoint}' processed in {duration:.4f} seconds.")
    return response

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
        # player -> state -> action -> Q-value
        self.q_table = {}

    def compute_future_value(self, state: str, player: str):
        """
        Estimate the value of the next state, factoring in both the opponent's and our own best options.
        Penalize states where the opponent has a strong move.
        """
        opponent = "X" if player == "O" else "O"
        opp_values = self.q_table.get(opponent, {}).get(state, {}).values()
        if opp_values:
            max_opp = max(opp_values, default=0)
            if max_opp > 0:
                return -max_opp  # Bad for us
        our_values = self.q_table.get(player, {}).get(state, {}).values()
        return max(our_values, default=0)

    def compute_action_from_q_values(self, state: str, player: str):
        """Compute the best action from Q-values for a given state."""
        actions = self.q_table.get(player, {}).get(state, {})
        actions_by_value = sorted(actions.items(), key=lambda item: item[1], reverse=True)
        if not actions_by_value:
            return None
        logging.info(f"Actions for state {state} for player {player}: {actions_by_value[0][1]}")
        return [action for action, value in actions_by_value if value == actions_by_value[0][1]]

    def choose_action(self, state: str, valid_moves: list, player: str):
        """Choose an action using an epsilon-greedy strategy."""
        if random.random() < self.exploration_rate:
            return random.choice(valid_moves)
        actions = self.compute_action_from_q_values(state, player)
        if actions:
            return random.choice(actions)
        else:
            return random.choice(valid_moves)


    def update(self, state: str, action: int, next_state: str, reward: float, done: bool, player: str):
        """
        Update the Q-table using the Bellman equation.
        Penalize next states where opponent has strong responses
        """
        next_score = self.compute_future_value(next_state, player)
        offset = next_score * self.discount_factor
        self.q_table.setdefault(player, {}).setdefault(state, {}).setdefault(action, 0)
        self.q_table[player][state][action] = (
            (1 - self.learning_rate) * self.q_table[player][state][action]
            + self.learning_rate * (reward + offset)
        )



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
    move = agent.choose_action(state_key, valid_moves, player)

    return jsonify({"move": move})

@app.route("/learn", methods=["POST"])
def learn():
    """Receives the outcome of a move and triggers the agent's learning process."""
    load_state()  # Load the latest Q-table
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400

    state = data.get("state")
    action = data.get("action")
    next_state = data.get("next_state")
    reward = data.get("reward")
    done = data.get("done")
    player = data.get("player")

    if any(v is None for v in [state, action, next_state, reward, done]):
        return jsonify({"error": "Missing required fields"}), 400

    agent.update(
        state=state,
        action=action,
        next_state=next_state,
        reward=reward,
        done=done,
        player=player
    )

    # Decay exploration rate
    if done and agent.exploration_rate > 0.01:
        agent.exploration_rate *= 0.99
        app.logger.info(f"Exploration rate updated to {agent.exploration_rate:.4f}")

    save_state()

    return jsonify({"status": "ok"})


@app.route("/")
def index():
    """A simple endpoint to view the agent's Q-table."""
    return jsonify(agent.q_table)


if __name__ == "__main__":
    load_state()
    app.run(host="0.0.0.0", port=5000)

