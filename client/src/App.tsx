import React, { useState, useRef, useEffect } from 'react';
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

interface ScoreboardProps {
  gameHistory: Array<'X' | 'O' | 'Draw'>;
}

function Scoreboard({ gameHistory }: ScoreboardProps) {
  console.log("Game History:", gameHistory);
  const calculateStats = (games: Array<'X' | 'O' | 'Draw'>) => {
    return games.reduce((acc, winner) => {
      if (winner === 'X') acc.xWins++;
      if (winner === 'O') acc.oWins++;
      if (winner === 'Draw') acc.draws++;
      return acc;
    }, { xWins: 0, oWins: 0, draws: 0 });
  };

  const totalStats = calculateStats(gameHistory);
  const last100Stats = gameHistory.length >= 100 ? calculateStats(gameHistory.slice(-100)) : null;
  const last50Stats = gameHistory.length >= 50 ? calculateStats(gameHistory.slice(-50)) : null;
  const last25Stats = gameHistory.length >= 25 ? calculateStats(gameHistory.slice(-25)) : null;
  const last10Stats = gameHistory.length >= 10 ? calculateStats(gameHistory.slice(-10)) : null;

  return (
    <div className="scoreboard">
      <h2>Scoreboard</h2>
      <table className="scoreboard-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Total</th>
            {last100Stats && <th>Last 100</th>}
            {last50Stats && <th>Last 50</th>}
            {last25Stats && <th>Last 25</th>}
            {last10Stats && <th>Last 10</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>X Wins</td>
            <td>{totalStats.xWins}</td>
            {last100Stats && <td>{last100Stats.xWins}</td>}
            {last50Stats && <td>{last50Stats.xWins}</td>}
            {last25Stats && <td>{last25Stats.xWins}</td>}
            {last10Stats && <td>{last10Stats.xWins}</td>}
          </tr>
          <tr>
            <td>O Wins</td>
            <td>{totalStats.oWins}</td>
            {last100Stats && <td>{last100Stats.oWins}</td>}
            {last50Stats && <td>{last50Stats.oWins}</td>}
            {last25Stats && <td>{last25Stats.oWins}</td>}
            {last10Stats && <td>{last10Stats.oWins}</td>}
          </tr>
          <tr>
            <td>Draws</td>
            <td>{totalStats.draws}</td>
            {last100Stats && <td>{last100Stats.draws}</td>}
            {last50Stats && <td>{last50Stats.draws}</td>}
            {last25Stats && <td>{last25Stats.draws}</td>}
            {last10Stats && <td>{last10Stats.draws}</td>}
          </tr>
          <tr>
            <td>Draw %</td>
            <td>{gameHistory.length > 0 ? `${((totalStats.draws / gameHistory.length) * 100).toFixed(2)}%` : '0.00%'}</td>
            {last100Stats && <td>{`${last100Stats.draws}%`}</td>}
            {last50Stats && <td>{`${(last50Stats.draws / 50 * 100).toFixed(2)}%`}</td>}
            {last25Stats && <td>{`${(last25Stats.draws / 25 * 100).toFixed(2)}%`}</td>}
            {last10Stats && <td>{`${(last10Stats.draws / 10 * 100).toFixed(2)}%`}</td>}
          </tr>
          <tr>
            <td>Total Games</td>
            <td>{gameHistory.length}</td>
            {last100Stats && <td>100</td>}
            {last50Stats && <td>50</td>}
            {last25Stats && <td>25</td>}
            {last10Stats && <td>10</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface QTableDisplayProps {
  qTable: any;
}

function QTableDisplay({ qTable }: QTableDisplayProps) {
  if (!qTable) {
    return <div>Loading Q-Table...</div>;
  }

  const getHeatmapColor = (value: number) => {
    const normalizedValue = (value + 1) / 2;
    const hue = normalizedValue * 120;
    return `hsl(${hue}, 100%, 50%)`;
  };

  return (
    <div className="q-table-display">
      <h2>Q-Table Visualization</h2>
      <div className="q-table-container">
        {Object.entries(qTable).map(([boardKey, actions]) => (
          <div key={boardKey} className="q-table-board">
            <div className="board-representation">
              {boardKey.split('').map((char, index) => (
                <div key={index} className={`mini-square ${char === '1' ? 'player-one' : char === '0' ? 'player-two' : ''}`}>
                  {char}
                </div>
              ))}
            </div>
            <div className="action-values">
              {Object.entries(actions as any).map(([action, value]) => (
                <div key={action} className="action-value" style={{ backgroundColor: getHeatmapColor(value as number) }}>
                  {action}: {(value as number).toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState<string>("Your turn (X)");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [winner, setWinner] = useState<SquareValue>(null);
  const [aiPlaying, setAiPlaying] = useState<boolean>(false);
  const [continuousPlay, setContinuousPlay] = useState<boolean>(false);
  const [gameHistory, setGameHistory] = useState<Array<'X' | 'O' | 'Draw'>>([]);
  const [qTable, setQTable] = useState<any>(null);
  const continuousPlayRef = useRef(continuousPlay);

  useEffect(() => {
    continuousPlayRef.current = continuousPlay;
  }, [continuousPlay]);

  useEffect(() => {
    const fetchQTable = async () => {
      try {
        const response = await fetch(`${API_URL}/api/q-table`);
        const data = await response.json();
        setQTable(data);
      } catch (error) {
        console.error("Error fetching Q-table:", error);
      }
    };

    const intervalId = setInterval(fetchQTable, 3000);
    fetchQTable();

    return () => clearInterval(intervalId);
  }, []);



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
        if (data.winner) {
          setGameHistory(prev => [...prev, data.winner]);
        } else if (data.history.length === 9) {
          setGameHistory(prev => [...prev, 'Draw']);
        }
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
    setWinner(null);
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
          setWinner(data.winner);
          if (data.winner) {
            setGameHistory(prev => [...prev, data.winner]);
          } else if (data.history.length === 9) {
            setGameHistory(prev => [...prev, 'Draw']);
          }
          if (!continuousPlayRef.current) {
            setStatus(`${data.status}\b AI finished, play or watch again.`);
            setAiPlaying(false);
          } else {
            setStatus(data.status)
            setTimeout(() => {
              playAIGame();
            }, 500);
          }
        }
      }, 200);
    } catch (error) {
      console.error("Error starting AI game:", error);
      setStatus("Error: Could not connect to server.");
    }
  }

  function constantAIGames() {
    setContinuousPlay(true);
    playAIGame()
  }

  function stopAIGames() {
    setContinuousPlay(false);
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
        <button onClick={constantAIGames} disabled={continuousPlay}>Continuous</button>
        <button onClick={stopAIGames} disabled={!continuousPlay}>StopContinuous</button>
      </div>
      <Scoreboard gameHistory={gameHistory} />
      <QTableDisplay qTable={qTable} />
    </div>
  );
}


export default App;