We want to build an RL agent that learns to play tic-tac-toe

What does it need to learn:

1. It is very bad to move in such a way that the player after your move wins
2. It is preferable to win the game
3. You should never lose the game


How do we shape rewards


if you won: 100 points
the move you made right before someone won: -100 points


Wins:

reward=100+(9−t)×5

Loses:

reward=−100−(9−t)×5



# client

simplify the client
have a view that plays tic tac toe and tracks and sends the history to the server
the server then adds a single entry to the history

history = [
    {
        player: str
        move: int
    }
]

server adds winner to the return

# server

takes the history
checks if someone won
if someone one sends the history to a learn endpoint in the backend
if someone has not won calls the agent to request a new move

# agent

uses learn to learn from the history
uses move to generate a move
