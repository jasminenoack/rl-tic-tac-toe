import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8080';

type SquareValue = 'X' | 'O' | null;

interface SquareProps {
  value: SquareValue;
  onSquareClick: () => void;
}

function Square({ value, onSquareClick }: SquareProps) {
  return (
    <button className="square" onClick={onSquareClick}>
      {value}
    </button>
  );
}

interface BoardProps {
  squares: SquareValue[];
  onPlay: (i: number) => void;
}

function Board({ squares, onPlay }: BoardProps) {
  function handleClick(i: number) {
    if (squares[i] || checkWinner(squares)) {
      return;
    }
    onPlay(i);
  }

  return (
    <div>
      <div className="board-row">
        <Square value={squares[0]} onSquareClick={() => handleClick(0)} />
        <Square value={squares[1]} onSquareClick={() => handleClick(1)} />
        <Square value={squares[2]} onSquareClick={() => handleClick(2)} />
      </div>
      <div className="board-row">
        <Square value={squares[3]} onSquareClick={() => handleClick(3)} />
        <Square value={squares[4]} onSquareClick={() => handleClick(4)} />
        <Square value={squares[5]} onSquareClick={() => handleClick(5)} />
      </div>
      <div className="board-row">
        <Square value={squares[6]} onSquareClick={() => handleClick(6)} />
        <Square value={squares[7]} onSquareClick={() => handleClick(7)} />
        <Square value={squares[8]} onSquareClick={() => handleClick(8)} />
      </div>
    </div>
  );
}

function App() {
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [status, setStatus] = useState<string>("Your turn (X)");

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => console.log("WebSocket connected");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received from WebSocket:", data);
      setBoard(data.board);
      setStatus(data.status);
    };
    ws.onclose = () => console.log("WebSocket disconnected");

    return () => {
      ws.close();
    };
  }, []);

  async function handlePlay(move: number) {
    const newBoard = board.slice();
    newBoard[move] = 'X';
    setBoard(newBoard);
    setStatus("Opponent is thinking...");

    setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board: board, move }),
        });
        const data = await response.json();
        setBoard(data.board);
        setStatus(data.status);
      } catch (error) {
        console.error("Error making move:", error);
        setStatus("Error: Could not connect to server.");
      }
    }, 500);
  }

  async function startAgentGame() {
    try {
      await fetch(`${API_URL}/api/start-agent-game`, { method: 'POST' });
      setStatus("Agent vs. Agent game started. Watching...");
    } catch (error) {
      console.error("Error starting agent game:", error);
      setStatus("Error: Could not start agent game.");
    }
  }

  async function handlePlayAgain() {
    try {
      const response = await fetch(`${API_URL}/api/reset`, { method: 'POST' });
      const data = await response.json();
      setBoard(data.board);
      setStatus(data.status);
    } catch (error) {
      console.error("Error resetting game:", error);
      setStatus("Error: Could not reset game.");
    }
  }

   return (
    <div className="game">
      <h1>Tic-Tac-Toe RL</h1>
      <div className="game-board">
        <Board squares={board} onPlay={handlePlay} />
      </div>
      <div className="game-info">
        <div>{status}</div>
        <button onClick={startAgentGame}>Watch Agents Play</button>
        <button onClick={handlePlayAgain}>Play Again</button>
      </div>
    </div>
  );
}

function checkWinner(squares: SquareValue[]): SquareValue {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
            return squares[a];
        }
    }
    return null;
}


export default App;