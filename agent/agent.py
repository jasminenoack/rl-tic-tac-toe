import os
import json
import random
from flask import Flask, request, jsonify

app = Flask(__name__)

# The path for the agent's persistent state, mounted from the Docker volume
STATE_FILE = "/data/agent_state.json"

# The agent's "brain" - a simple Q-table dictionary
q_table = {}


def load_state():
    """Loads the Q-table from the state file if it exists."""
    global q_table
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            q_table = json.load(f)
        app.logger.info(f"Loaded agent state from {STATE_FILE}")
    else:
        app.logger.info("No state file found. Starting with a new Q-table.")


def save_state():
    """Saves the Q-table to the state file."""
    with open(STATE_FILE, "w") as f:
        json.dump(q_table, f, indent=2)
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

    # Choose a random move from the list of valid moves
    move = random.choice(valid_moves)

    # In a real RL agent, you would:
    # 1. Look up the current board state in the q_table.
    # 2. Decide whether to explore (random move) or exploit (best known move).
    # 3. Return the chosen move.
    # q_table['some_board_state_representation'] = {'action': move, 'value': 0.5}
    # save_state()

    return jsonify({"move": move})


