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

        moves = self.q_table.get(self.build_board_key(board, player), {})
        moves = {move: moves.get(move, 0) for move in valid_moves}

        best_moves = [
            move for move in valid_moves
            if moves[move] == max(moves.values())
        ]
        return random.choice(best_moves)



    def learn(self, history: list, winner: str):
        reward = 1
        decay = 0.6

        for i in range(len(history))[::-1]:
            reward *= decay
            turn = history[i]

            board_key = self.build_board_key(board_at_turn(history, i), turn["player"])
            if board_key not in self.q_table:
                self.q_table[board_key] = defaultdict(float)

            move = turn["turn"]
            if move not in self.q_table[board_key]:
                self.q_table[board_key][str(move)] = 0.0

            self.q_table[board_key][str(move)] += self.learning_rate * reward * (1 if winner == turn["player"] else -1)

        agent.exploration_rate *= 0.99




agent = RLAgent()


def load_state():
    """Loads the Q-table from the state file if it exists."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            agent.q_table = json.load(f)
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


if __name__ == "__main__":
    load_state()
    app.run(host="0.0.0.0", port=5000)

