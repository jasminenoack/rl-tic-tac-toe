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

const AGENT_MOVE_URL = 'http://agent:5001/get_move';
const AGENT_LEARN_URL = 'http://agent:5001/learn';

type SquareValue = 'X' | 'O' | null;

// --- Abstraction ---

interface Move {
    player: SquareValue;
    turn: number;
}

async function getMove(history: Turn[]): Promise<Move> {
    try {
        const response = await axios.post(AGENT_MOVE_URL, { history });
        return {
            player: response.data.player as SquareValue,
            turn: response.data.move as number
        };
    } catch (error) {
        throw new Error(`Error getting move from agent: ${(error as Error).message}`);
    }
}

async function learn(history: Turn[], winner: SquareValue): Promise<void> {
    try {
        await axios.post(AGENT_LEARN_URL, { history, winner });
    } catch (error) {
        throw new Error(`Error learning from agent: ${(error as Error).message}`);
    }
}

interface Turn {
  player: SquareValue;
  turn: number;
}

class Board {
    board: (SquareValue | null)[];
    constructor(
        public turns: Turn[]
    ) {
        this.board = [null, null, null, null, null, null, null, null, null];
        turns.forEach(turn => {
            this.board[turn.turn] = turn.player as SquareValue;
        });
    }

    won() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6]  // diagonals
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a];
            }
        }
        return null;
    }
}


async function runTurn(history: Turn[], res: Response): Promise<express.Response<any, Record<string, any>> | null> {
    const board = new Board(history);
    const winner = board.won();
    if (board.won() || history.length === 9) {
        await learn(history, winner);

        let status = 'Game ended in a draw.';
        if (winner) {
            status = (`Winner: ${winner}`);
        }

        return res.json({
            history: history,
            status: status,
            winner: winner
        });
    }
    return null;
}

// --- API Endpoints ---

app.post('/api/move', async (req: Request, res: Response) => {
    const {history}: { history: Turn[] } = req.body;
    let pontentialResponse = await runTurn(history, res);
    if (pontentialResponse) {
        return pontentialResponse;
    }
    console.log(pontentialResponse);

    const move = await getMove(history);
    const agentMove = move.turn;
    const player = move.player;
    const newHistory = [...history, { player, turn: agentMove }];
    pontentialResponse = await runTurn(newHistory, res);
    if (pontentialResponse) {
        return pontentialResponse;
    }

    res.json({
        history: newHistory,
        status: 'Your turn (X)',
        winner: null
    });
});

app.post('/api/game', async (req: Request, res: Response) => {
    const history: Turn[] = [];
    let won: boolean = false;

    while (!won && history.length < 9) {
        const move = await getMove(history);
        const agentMove = move.turn;
        const player = move.player;
        history.push({ player, turn: agentMove });
        const pontentialResponse = await runTurn(history, res);
        if (pontentialResponse) {
            return pontentialResponse;
        }
    }

    res.json(
        {
            history: history,
            winner: null
        }
    )
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});