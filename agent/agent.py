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

# --- Symmetry Helper Functions ---

def _transform(r, c, transform_id):
    # apply flip
    if transform_id >= 4:
        c = 2 - c
    # apply rotation
    rotations = transform_id % 4
    for _ in range(rotations):
        r, c = c, 2 - r
    return r, c

def _untransform(r, c, transform_id):
    # apply inverse rotation
    rotations = transform_id % 4
    for _ in range(rotations):
        r, c = 2 - c, r
    # apply inverse flip (which is the same flip)
    if transform_id >= 4:
        c = 2 - c
    return r, c

def transform_board(board, transform_id):
    new_board = [None] * 9
    for i in range(9):
        r, c = i // 3, i % 3
        tr, tc = _transform(r, c, transform_id)
        new_board[tr * 3 + tc] = board[i]
    return new_board

def transform_action(action, transform_id):
    r, c = action // 3, action % 3
    tr, tc = _transform(r, c, transform_id)
    return tr * 3 + tc

def untransform_action(action, transform_id):
    r, c = action // 3, action % 3
    tr, tc = _untransform(r, c, transform_id)
    return tr * 3 + tc

def get_canonical_form(board: list):
    """
    Finds the canonical representation of a board state.
    Returns the canonical board and the transform_id that creates it.
    """
    symmetries = []
    for i in range(8):
        symmetries.append(transform_board(board, i))

    # Use the string representation to find the lexicographically smallest board
    # We replace None with '.' to make sorting work consistently
    canonical_board_str = min("".join(x or '.' for x in b) for b in symmetries)

    # Find the transform_id that produced this canonical board
    transform_id = 0 # Default to 0
    canonical_board = symmetries[0]
    for i in range(8):
        b_str = "".join(x or '.' for x in symmetries[i])
        if b_str == canonical_board_str:
            transform_id = i
            canonical_board = symmetries[i]
            break

    return canonical_board, transform_id


class RLAgent:
    def __init__(self, learning_rate=0.1, discount_factor=0.9, exploration_rate=0.5):
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.exploration_rate = exploration_rate
        self.min_exploration_rate = 0.01
        # player -> state -> action -> Q-value
        self.q_table = {}

    def build_board_key(self, board: list, player: str) -> str:
        """
        Generates a key for the board state
        1 = current player, 0 = other player
        """
        board_key = ''.join(['1' if square == player else '0' if square is not None else '.' for square in board])
        return f"{board_key}"

    def choose_action(self, board: list, valid_moves: list, player: str) -> int:
        if random.random() < self.exploration_rate:
            return random.choice(valid_moves)

        canonical_board, transform_id = get_canonical_form(board)
        board_key = self.build_board_key(canonical_board, player)
        q_values = self.q_table.get(board_key, {})

        canonical_valid_moves = [transform_action(m, transform_id) for m in valid_moves]

        # Encourage exploration by defaulting to a neutral Q-value for unseen moves.
        valid_q_values = {move: q_values.get(str(move), 0.0) for move in canonical_valid_moves}

        if not valid_q_values:
            return random.choice(valid_moves)

        max_q = max(valid_q_values.values())

        best_canonical_moves = [
            move for move, q in valid_q_values.items() if q == max_q
        ]

        # This check is likely redundant now but kept for safety.
        if not best_canonical_moves:
            return random.choice(valid_moves)

        best_canonical_move = random.choice(best_canonical_moves)

        # Translate the best canonical move back to a move on the original board
        return untransform_action(best_canonical_move, transform_id)


    def learn(self, history: list, winner: str):
        logging.info(f"Exploration rate before learning: {self.exploration_rate}")
        reward = 1 if winner else 0
        decay = 0.6

        for i in range(len(history))[::-1]:
            reward *= decay
            turn = history[i]
            player = turn["player"]
            move = turn["turn"]
            board = board_at_turn(history, i)

            # Convert the board state to its canonical form before learning
            canonical_board, transform_id = get_canonical_form(board)
            canonical_move = transform_action(move, transform_id)
            board_key = self.build_board_key(canonical_board, player)

            if board_key not in self.q_table:
                self.q_table[board_key] = defaultdict(float)

            update_value = self.learning_rate * reward * (1 if winner == player else -1)
            self.q_table[board_key][str(canonical_move)] += update_value

        self.exploration_rate = max(
            self.min_exploration_rate,
            self.exploration_rate * 0.99
        )


agent = RLAgent()


def convert_q_table(loaded_q_table):
    """Converts a loaded Q-table from dicts to defaultdicts."""
    new_q_table = {}
    for board_key, moves in loaded_q_table.items():
        new_q_table[board_key] = defaultdict(float, moves)
    return new_q_table


def load_state():
    """Loads the Q-table from the state file if it exists."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            loaded_q = json.load(f)
            agent.q_table = convert_q_table(loaded_q)
        app.logger.info(f"Loaded agent state from {STATE_FILE}")
    else:
        app.logger.info("No state file found. Starting with a new Q-table.")

def get_other_player(player: str) -> str:
    """Returns the other player based on the current player."""
    return "X" if player == "O" else "O"

def save_state():
    """Saves the Q-table to the state file."""
    with open(STATE_FILE, "w") as f:
        json.dump(agent.q_table, f, indent=2)
    app.logger.info(f"Saved agent state to {STATE_FILE}")


@app.route("/health")
def health_check():
    """A simple health check endpoint."""
    return "OK", 200


def board_at_turn(history, turn):
    """Returns the board state at a specific turn."""
    board = [None] * 9
    for i in range(turn):
        if i < len(history):
            board[history[i]["turn"]] = history[i]["player"]
    return board


@app.route("/get_move", methods=["POST"])
def get_move():
    load_state()  # Load the latest Q-table
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400
    if "history" not in data:
        return jsonify({"error": "Missing 'history' field"}), 400
    history = data["history"]
    last_turn = history[-1] if history else None
    last_player = last_turn["player"] if last_turn else "X"
    current_player = get_other_player(last_player)
    board = board_at_turn(history, len(history))

    valid_moves = [i for i, square in enumerate(board) if square is None]
    if not valid_moves:
        return jsonify({"error": "No valid moves available"}), 400

    move = agent.choose_action(
        board=board,
        valid_moves=valid_moves,
        player=current_player
    )

    return jsonify({"move": move, "player": current_player})

@app.route("/learn", methods=["POST"])
def learn():
    load_state()  # Load the latest Q-table
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400
    if "history" not in data:
        return jsonify({"error": "Missing 'history' field"}), 400
    history = data["history"]
    if "winner" not in data:
        return jsonify({"error": "Missing 'winner' field"}), 400
    winner = data["winner"]

    agent.learn(
        history=history,
        winner=winner
    )

    save_state()

    return jsonify({"status": "ok"})


@app.route("/")
def index():
    """A simple endpoint to view the agent's Q-table."""
    load_state()
    return jsonify(agent.q_table)

@app.route("/get_q_table", methods=["GET"])
def get_q_table():
    """Returns the agent's Q-table."""
    load_state()
    return jsonify(agent.q_table)


if __name__ == "__main__":
    load_state()
    app.run(host="0.0.0.0", port=5001)

