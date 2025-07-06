import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const AGENT_URL = 'http://agent:5001/get_move';
const AGENT_LEARN_URL = 'http://agent:5001/learn';

type SquareValue = 'X' | 'O' | null;
type Board = SquareValue[];

// --- Player Abstraction ---

abstract class Player {
    constructor(public symbol: 'X' | 'O') {}
    abstract getMove(gameState: Board, move?: number): Promise<number | null>;

    async learn(state: string, action: number, nextState: string, reward: number, done: boolean, player: string): Promise<void> {
        try {
            await axios.post(AGENT_LEARN_URL, {
                state,
                action,
                next_state: nextState,
                reward,
                done,
                player,
            });
        } catch (error) {
            console.error("Error calling agent's learn endpoint:", (error as Error).message);
        }
    }
}

class HumanPlayer extends Player {
    async getMove(gameState: Board, move: number): Promise<number> {
        return move;
    }
}

class RemoteAgentPlayer extends Player {
    async getMove(gameState: Board): Promise<number | null> {
        try {
            const response = await axios.post(AGENT_URL, {
                board: gameState,
                player: this.symbol
            });
            return response.data.move;
        } catch (error) {
            console.error("Error contacting agent:", (error as Error).message);
            const validMoves = gameState.map((s, i) => s === null ? i : null).filter(i => i !== null) as number[];
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }


}

// --- WebSocket Logic ---

wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
});

function broadcast(data: object) {
    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// --- Game Logic ---

function checkWinner(board: Board): 'X' | 'O' | 'draw' | null {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]  // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as 'X' | 'O';
        }
    }
    if (board.every(square => square !== null)) {
        return 'draw';
    }
    return null;
}

function playTurn(board: Board, player: Player, move: number): Board {
    const stateBeforeMove = board.map(s => s === null ? '-' : s).join('');
    const newBoard = [...board];
    newBoard[move] = player.symbol;
    const winner = checkWinner(newBoard);
    let reward = 0;
    if (winner && winner == player.symbol) {
        reward = 1;
    } else if (winner == "draw") {
        reward = 0.5
    } else if (winner && winner !== player.symbol) {
        reward = -1;
    }
    player.learn(
        stateBeforeMove,
        move,
        newBoard.map(s => s === null ? '-' : s).join(''),
        reward,
        winner !== null && winner !== 'draw',
        player.symbol
    );
    return newBoard;
}

// --- API Endpoints ---

app.post('/api/move', async (req: Request, res: Response) => {
    let { board, move }: { board: Board, move: number } = req.body;
    const human = new HumanPlayer('X');
    const agent = new RemoteAgentPlayer('O');

    board = playTurn(board, human, move);

    let winner = checkWinner(board);
    if (winner) {
        return res.json({ board, status: winner === 'draw' ? 'draw' : `${winner}-wins` });
    }

    // Get agent move
    const agentMove = await agent.getMove(board);

    if (agentMove !== null) {
        board = playTurn(board, agent, agentMove);
    }
    winner = checkWinner(board);
    if (winner) {
        return res.json({ board, status: winner === 'draw' ? 'draw' : `${winner}-wins` });
    }

    res.json({ board, status: 'in-progress' });
});

app.post('/api/start-agent-game', async (req: Request, res: Response) => {
    console.log("Starting Agent vs. Agent game...");
    const player1 = new RemoteAgentPlayer('X');
    const player2 = new RemoteAgentPlayer('O');
    let board: Board = Array(9).fill(null);
    let currentPlayer: Player = player1;
    let status = 'in-progress';

    res.status(200).json({ message: "Agent vs. Agent game started. Watch for WebSocket updates." });

    const gameLoop = setInterval(async () => {
        const move = await currentPlayer.getMove(board);
        if (move === null) {
            clearInterval(gameLoop);
            return;
        }
        board = playTurn(board, currentPlayer, move);

        const winner = checkWinner(board);
        if (winner) {
            status = winner === 'draw' ? 'draw' : `${winner}-wins`;
            broadcast({ board, status });
            clearInterval(gameLoop);
            return;
        }

        broadcast({ board, status });
        currentPlayer = (currentPlayer === player1) ? player2 : player1;
    }, 500);
});

app.post('/api/reset', (req: Request, res: Response) => {
    const board: Board = Array(9).fill(null);
    const status = "Your turn (X)";
    broadcast({ board, status });
    res.json({ board, status });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});