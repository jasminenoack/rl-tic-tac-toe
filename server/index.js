const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const AGENT_URL = 'http://agent:5001/get_move';

// --- Player Abstraction ---

class Player {
    constructor(symbol) {
        this.symbol = symbol;
    }
    async getMove(gameState) {
        throw new Error("Player.getMove() must be implemented by subclass");
    }
}

class HumanPlayer extends Player {
    // The move for a human is provided directly from the API call
    async getMove(gameState, move) {
        return move;
    }
}

class RemoteAgentPlayer extends Player {
    async getMove(gameState) {
        try {
            const response = await axios.post(AGENT_URL, {
                board: gameState,
                player: this.symbol
            });
            return response.data.move;
        } catch (error) {
            console.error("Error contacting agent:", error.message);
            // Return a random valid move as a fallback
            const validMoves = gameState.map((s, i) => s === null ? i : null).filter(i => i !== null);
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }
}


// --- WebSocket Logic ---

wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(data));
        }
    });
}


// --- Game Logic ---

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]  // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // 'X' or 'O'
        }
    }
    if (board.every(square => square !== null)) {
        return 'draw';
    }
    return null;
}

// --- API Endpoints ---

app.post('/api/move', async (req, res) => {
    // Human vs. Agent game logic
    const { board, move } = req.body;
    const human = new HumanPlayer('X');
    const agent = new RemoteAgentPlayer('O');

    // Apply human move
    board[move] = human.symbol;
    let winner = checkWinner(board);
    if (winner) {
        return res.json({ board, status: winner === 'draw' ? 'draw' : `${winner}-wins` });
    }

    // Get agent move
    const agentMove = await agent.getMove(board);
    board[agentMove] = agent.symbol;
    winner = checkWinner(board);
    if (winner) {
        return res.json({ board, status: winner === 'draw' ? 'draw' : `${winner}-wins` });
    }

    res.json({ board, status: 'in-progress' });
});

app.post('/api/start-agent-game', async (req, res) => {
    console.log("Starting Agent vs. Agent game...");
    const player1 = new RemoteAgentPlayer('X');
    const player2 = new RemoteAgentPlayer('O');
    let board = Array(9).fill(null);
    let currentPlayer = player1;
    let status = 'in-progress';

    res.status(200).json({ message: "Agent vs. Agent game started. Watch for WebSocket updates." });

    const gameLoop = setInterval(async () => {
        const move = await currentPlayer.getMove(board);
        board[move] = currentPlayer.symbol;

        const winner = checkWinner(board);
        if (winner) {
            status = winner === 'draw' ? 'draw' : `${winner}-wins`;
            broadcast({ board, status });
            clearInterval(gameLoop);
            return;
        }

        broadcast({ board, status });
        currentPlayer = (currentPlayer === player1) ? player2 : player1;

    }, 1000); // 1 second delay between moves for watchability
});

app.post('/api/reset', (req, res) => {
    const board = Array(9).fill(null);
    const status = "Your turn (X)";
    broadcast({ board, status });
    res.json({ board, status });
});


const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});