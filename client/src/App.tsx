import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:8080';

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
  turns: Turn[];
  onPlay: (i: number) => void;
  winner: string | null;
}

function Board({ turns, onPlay, winner }: BoardProps) {
  function handleClick(i: number) {
    if (squares[i]) {
      return;
    }
    if (turns.length == 9 || winner) {
      return;
    }
    onPlay(i);
  }

  const squares: SquareValue[] = Array(9).fill(null);
  turns.forEach(turn => {
    squares[turn.turn] = turn.player as SquareValue;
  });

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

interface Turn {
  player: string;
  turn: number;
}

function App() {
  const [status, setStatus] = useState<string>("Your turn (X)");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [winner, setWinner] = useState<SquareValue>(null);
  const [aiPlaying, setAiPlaying] = useState<boolean>(false);


  async function handlePlay(move: number) {
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.player === 'X') {
      setStatus("You already played. Wait for your opponent.");
      return;
    }
    if (aiPlaying) {
      setStatus("Please wait stop the AI first.");
    }
    if (winner) {
      setStatus("Game over. Please start a new game.");
      return;
    }
    const newTurns = [...turns, { player: 'X', turn: move }];
    setTurns(newTurns);

    setStatus("Opponent is thinking...");

    setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history: newTurns }),
        });
        const data = await response.json();
        setStatus(data.status);
        setTurns(data.history);
        setWinner(data.winner);
      } catch (error) {
        console.error("Error making move:", error);
        setStatus("Error: Could not connect to server.");
      }
    }, 500);
  }

  async function playAIGame() {
    setAiPlaying(true);
    setStatus("AI is playing...");
    setTurns([]);
    try {
      const response = await fetch(`${API_URL}/api/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      let turnNumber = 0;
      const interval = setInterval(() => {
        if (turnNumber < data.history.length) {
          const turn = data.history[turnNumber];
          setTurns(prevTurns => [...prevTurns, turn]);
          turnNumber++;
        }
        if (turnNumber >= data.history.length) {
          clearInterval(interval);
          setStatus(`${data.status}\b AI finished, play or watch again.`);
          setAiPlaying(false);
        }
      }, 500);
    } catch (error) {
      console.error("Error starting AI game:", error);
      setStatus("Error: Could not connect to server.");
    }
  }

  function handlePlayAgain() {
      setTurns([]);
      setWinner(null);
      setStatus("Your turn (X)");
  }

   return (
    <div className="game">
      <h1>Tic-Tac-Toe RL</h1>
      <div className="game-board">
        <Board turns={turns} onPlay={handlePlay} winner={winner} />
      </div>
      <div className="game-info">
        <div>{status}</div>
        {/* <button onClick={startAgentGame}>Watch Agents Play</button> */}
        <button onClick={handlePlayAgain}>Play Again</button>
        <button onClick={playAIGame}>Watch AI</button>
      </div>
    </div>
  );
}


export default App;