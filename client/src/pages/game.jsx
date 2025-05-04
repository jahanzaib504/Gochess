import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useEffect, useState, useRef, useContext } from 'react';
import { FaRegClock, FaBolt } from 'react-icons/fa';
import { GiBulletBill } from 'react-icons/gi';
import { io } from 'socket.io-client';
import AuthContext from '../components/AuthContext';
import UserProfileBadge from '../components/userprofilebadge';
import { toast } from 'react-toastify';

//List to store respective timing of games
const gameTimeMapping = {
  Rapid: 600,
  Blitz: 300,
  Bullet: 180,
};




const Menu = ({ gameType, setGameType, join_game }) => {
  const gameOptions = [
    { name: 'Blitz', icon: <FaBolt /> },
    { name: 'Rapid', icon: <FaRegClock /> },
    { name: 'Bullet', icon: <GiBulletBill /> }
  ];

  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-gradient-to-br from-gray-200 to-gray-50">
      <div className="flex flex-row gap-8 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col gap-4">
          {gameOptions.map(({ icon, name }, index) => (
            <button
              key={index}
              className={`flex items-center gap-3 px-6 py-3 text-lg rounded-lg font-medium transition-all ${gameType === name
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              onClick={() => setGameType(name)}
            >
              {icon}
              <span>{name}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col justify-center gap-4 bg-gray-100 p-4 rounded-lg shadow-inner text-gray-700 font-semibold">
          <div>Rapid – 10 min</div>
          <div>Bullet – 3 min</div>
          <div>Blitz – 5 min</div>
        </div>
      </div>
      <div className="absolute bottom-10">
        <button
          className={`px-6 py-3 text-lg font-semibold rounded-full shadow-lg transition-all ${gameType ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'
            } text-white`}
          onClick={join_game}
          disabled={!gameType}
        >
          Play
        </button>
      </div>
    </div>
  );
};
//Simulates waiting for opponenet 
const Waiting = ({ stop_waiting_for_opponent, gameType }) => (
  <div className="flex h-screen w-screen justify-center items-center bg-gray-100">
    <div className="flex flex-col items-center gap-6 p-8 rounded-xl shadow-xl bg-white">
      <div className="text-xl text-gray-700 font-semibold">
        Waiting for opponent in {gameType} game...
      </div>
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <button
        className="w-full py-2 px-4 text-lg bg-red-600 text-white rounded-md shadow hover:bg-red-700"
        onClick={stop_waiting_for_opponent}
      >
        Cancel
      </button>
    </div>
  </div>
);

const GamePage = () => {
  //Store games instance
  const [game, setGame] = useState(new Chess());
  //Current board state
  const [fen, setFen] = useState(game.fen());
  //If game is active then simulate game
  const [active, setActive] = useState(false);
  const [gameType, setGameType] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [gameId, setGameId] = useState(null);
  //White always starts first
  const [turn, setTurn] = useState('white');
  //Fetch user info from context
  const { userInfo } = useContext(AuthContext);
  const [player2, setPlayer2] = useState({ email: '', color: '', time: 300 });
  const [player1, setPlayer1] = useState({ ...userInfo, color: '', time: 300 });
  //Store the timer reference for smooth cleanup
  const timerRef = useRef(null);
  //Store socket reference 
  const socketRef = useRef(null);
  const createSocket = () => {
    const token = localStorage.getItem('token');

    // Create socket with reconnection options
    const socket = io('http://127.0.0.1:5000', {
      query: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Add connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected');
      toast.success("Connected to game server");

    });


    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      toast.error(`Connection error: ${err.message || "Unknown error"}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      toast.warning(`Disconnected: ${reason}. Attempting to reconnect...`);
    });

    return socket;
  };


  // Initialize socket on component mount
  useEffect(() => {
    //Store the socket reference
    socketRef.current = createSocket();

    // Clean up socket connection on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const join_game = () => {
    if (!socketRef.current) {
      toast.error("Socket connection not established");
      return;
    }
    socketRef.current.emit('join_game', { gameType });
    setWaitingForOpponent(true);
  };

  const stop_waiting_for_opponent = () => {
    if (!socketRef.current) {
      toast.error("Socket connection not established");
      return;
    }
    socketRef.current.emit('stop_waiting_for_opponent', { gameType });
    setWaitingForOpponent(false);
  };

  const resign_game = () => {
    if (!socketRef.current || !gameId) {
      toast.error("Game not active or connection lost");
      return;
    }
    socketRef.current.emit('resign_game', { gameId });
    setActive(false);
    clearInterval(timerRef.current);
  };
  //Ongoing functionality
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  
    timerRef.current = setInterval(() => {
      if (turn === 'white') {
        setPlayer1(p1 => {
          if (p1.color === 'white') {
            const newTime = p1.time - 1;
            if (newTime <= 0) {
              clearInterval(timerRef.current);
              return { ...p1, time: 0 };
            }
            return { ...p1, time: newTime };
          }
          return p1;
        });
      } else if (turn === 'black') {
        setPlayer2(p2 => {
          if (p2.color === 'black') {
            const newTime = p2.time - 1;
            if (newTime <= 0) {
              clearInterval(timerRef.current);
              return { ...p2, time: 0 };
            }
            return { ...p2, time: newTime };
          }
          return p2;
        });
      }
    }, 1000);
  };
  

  const make_move = (source, target) => {
    if(turn != player1.color){
      toast.error('Not your turn')
      return}
    try {
      // Try to make the move locally first to validate
      const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Default promotion to queen
      });

      if (move) {
        // Update local board state
        setFen(game.fen());

        // Send move to server in UCI format (what the backend expects)
        if (socketRef.current) {
          const uciMove = `${source}${target}`;
          socketRef.current.emit('make_move', {
            gameId,
            move: uciMove
          });
          console.log(`Sent move to server: ${uciMove}`);
        }



        return true; // Return true to indicate valid move for react-chessboard
      }
      return false; // Return false for invalid moves
    } catch (error) {
      toast.error(`Move error: ${error.message}`);
      return false;
    }
  }


  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;
    //Handle events triggered from server
    socket.on('error', error => {
      toast.error(error.message || "An error occurred");
    });

    socket.on('connect_error', err => {
      toast.error("Connection error: " + (err.message || "Unknown error"));
    });

    socket.on('waiting_for_opponent', () => {
      setWaitingForOpponent(true);
      console.log("Waiting for opponent");
    });

    socket.on('game_found', ({ gameId, opponent }) => {
      console.log("Game found:", gameId, opponent);
      const time = gameTimeMapping[gameType] || 300;
      setWaitingForOpponent(false);
      setGameId(gameId);

      // Reset game state for new game
      const newGame = new Chess();
      setGame(newGame);
      setFen(newGame.fen());
      setTurn('white');

      // Set opponent information
      setPlayer2({
        email: opponent.email || "Opponent",
        color: opponent.color.toLowerCase(),
        time
      });

      // Set my color as opposite of opponent
      const myColor = opponent.color.toLowerCase() === 'white' ? 'black' : 'white';
      setPlayer1(prev => ({ ...prev, color: myColor, time }));

      setActive(true);
      startTimer();
    });



    socket.on('move_made', (moveData) => {
      try {
        console.log("Received move from server:", moveData);
        const { move, fen: serverFen, turn: serverTurn } = moveData;

        
        if (serverFen) {
          setFen(serverFen);
          setGame(new Chess(serverFen));
          setTurn(serverFen.split(' ')[1] === 'w' ? 'white' : 'black');
        } else if (move) {
          // Otherwise, apply the move to our local board
          // Check if we need to convert UCI to algebraic or use directly
          const moveResult = move.length === 4 || move.length === 5
            ? game.move({
              from: move.substring(0, 2),
              to: move.substring(2, 4),
              promotion: move.length === 5 ? move.charAt(4) : 'q'
            })
            : game.move(move);

          if (moveResult) {
            setFen(game.fen());
            setTurn(game.turn() === 'w' ? 'white' : 'black');
          } else {
            // If move fails to apply, request full board state from server
            if (socketRef.current && gameId) {
              socketRef.current.emit('request_board_state', { gameId });
              toast.warning("Synchronizing board state with server...");
            } else {
              toast.error("Invalid move received and unable to resync");
            }
          }
        }

        // Update timers if server sends time data
        if (moveData.player1_time !== undefined && moveData.player2_time !== undefined) {
          setPlayer1(prev => ({ ...prev, time: moveData.player1_time }));
          setPlayer2(prev => ({ ...prev, time: moveData.player2_time }));
        }
      } catch (err) {
        toast.error(`Error processing move: ${err.message}`);
        console.error("Move processing error:", err);

        // Request full board state from server on any error
        if (socketRef.current && gameId) {
          socketRef.current.emit('request_board_state', { gameId });
        }
      }
    });

    socket.on('game_over', ({ winner, reason }) => {
      // Determine the winner message
      console.log('winner player1', winner, player1)
      let message;
      if (!winner) {
        message = `Game ended in draw! (${reason})`;
      } else if (winner === player1.email) {
        message = `You win! (${reason})`;
      } else {
        message = `You lose! (${reason})`;
      }

      toast.info(message);
      setActive(false);
      clearInterval(timerRef.current);
    });

    return () => {
      socket.off('error');
      socket.off('connect_error');
      socket.off('waiting_for_opponent');
      socket.off('game_found');
      socket.off('move_made');
      socket.off('game_over');
      clearInterval(timerRef.current);
    };
  }, [gameType, player1.email, player1.color, player2.email, player2.color, game]);

  // Format time as minutes:seconds
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!active && !waitingForOpponent) {
    return <Menu setGameType={setGameType} gameType={gameType} join_game={join_game} />;
  }

  if (waitingForOpponent) {
    return <Waiting
      stop_waiting_for_opponent={stop_waiting_for_opponent}
      gameType={gameType}
    />;
  }

  return (
    <div className="flex w-screen h-screen justify-center items-center bg-gray-100">
      <div className="flex flex-col gap-4">
        <section className="flex gap-8">
          <Chessboard
            position={fen}
            onPieceDrop={make_move}
            boardWidth={400}
            boardOrientation={player1.color === 'black' ? 'black' : 'white'}
          />
          <div className="flex flex-col justify-evenly gap-6">
            <div className={`p-4 rounded-lg shadow ${player2.color === 'black' ? 'bg-black text-white' : 'bg-white text-black'}`}>
              <UserProfileBadge username={player2.email} />
              <div className="text-right font-mono">{formatTime(player2.time)}</div>
            </div>
            <div className={`p-4 rounded-lg shadow ${player1.color === 'black' ? 'bg-black text-white' : 'bg-white text-black'}`}>
              <UserProfileBadge username={player1.email} />
              <div className="text-right font-mono">{formatTime(player1.time)}</div>
            </div>
          </div>
        </section>
        <button
          className="self-center bg-red-600 text-white px-6 py-2 rounded-lg text-lg hover:bg-red-700 transition"
          onClick={resign_game}
          disabled={!active}
        >
          Resign
        </button>
      </div>
    </div>
  );
};

export default GamePage;