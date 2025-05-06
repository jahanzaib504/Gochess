from flask import Flask, request, jsonify, session
from flask_socketio import SocketIO, emit, disconnect, join_room, leave_room
import chess
import threading
import sqlite3
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, decode_token
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import os
import io
import time
import buildDatabase
from flask_cors import CORS
import uuid
import random
# Helper to establish a database connection
def get_connection():
    conn = sqlite3.connect('chess.db')
    conn.row_factory = sqlite3.Row  # To access columns by name
    cur = conn.cursor()
    return conn, cur

# Load environment variables
load_dotenv()
app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173"], allow_upgrades=True)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Helper function for standardized response
def make_response(message, data={}, code=200):
    response = {
        "message": message,
    } | data
    return jsonify(response), code

@app.route('/auth/log-in', methods=['POST'])
def log_in():
    data = request.get_json()
    email = data.get('email')
    password=data.get('password')

    if not email or not password:
        return make_response('Email or password not specified', code=400)
    
    conn, cur = get_connection()
    try:
        cur.execute('SELECT * FROM user WHERE email = ?', (email,))
        user = cur.fetchone()
        
        if user and bcrypt.check_password_hash(user['password'], password):
            token = create_access_token(identity=email)
            return make_response('User logged in successfully', {'token': token})
        else:
            return make_response('Invalid email or password', code=400)
    except sqlite3.Error as e:
        return make_response('Database error: ' + str(e), code=500)
    finally:
        conn.close()

# Route to check username availability
@app.route('/auth', methods=['GET'])
def check_username_availability():
    username = request.args.get('username')
    
    if not username:
        return make_response('Username not specified', code=400)
    
    conn, cur = get_connection()
    try:
        cur.execute('SELECT username FROM user WHERE username = ?', (username,))
        user = cur.fetchone()
        
        if user:
            return make_response('Username already exists', code=409)
        return make_response('Username is available')
    except sqlite3.Error as e:
        return make_response('Database error: ' + str(e), code=500)
    finally:
        conn.close()

# Route for user sign-up
@app.route('/auth/sign-up', methods=['POST'])
def sign_up():
    data = request.get_json()
    print(data)
    password = data.get('password')
    username = data.get('username')
    email=data.get('email')
    if not email or not password or not username:
        return make_response('All fields (email, password, username) are required', code=400)
    
    conn, cur = get_connection()
    try:
        # Hash password before storing
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        
        cur.execute('INSERT INTO user (username, email, password) VALUES (?, ?, ?)', (username, email, hashed_password,))
        conn.commit()
        token = create_access_token(identity=email)
        return make_response('Successfully signed up', {'token': token})
    except sqlite3.Error as e:
        return make_response('Database error: ' + str(e), code=500)
    finally:
        conn.close()

# Route to get user info (protected)
@app.route('/get_user_info', methods=['GET'])
@jwt_required()
def get_user_info():
    try:
        email = get_jwt_identity() # Extract user ID from JWT
        conn, cur = get_connection()
        cur.execute('SELECT * FROM user_view WHERE email = ?', (email,))
        user = cur.fetchone()
        if user:
            return make_response('User info found', {'user': dict(user)})
        return make_response('User not found', code=404)
    except Exception as e:
        return make_response('Error fetching user info: ' + str(e), code=500)
    finally:
        conn.close()

# Route to get game history
@app.route('/games', methods=['GET'])
@jwt_required()
def get_games():
    userid = request.args.get('userid')
    gameid = request.args.get('gameid')
    
    
    conn, cur = get_connection()
    try:
        
        if gameid:
            cur.execute('SELECT * FROM game_view WHERE gameid = ?', (gameid,))
        elif userid:
            cur.execute('SELECT * FROM game_view WHERE userid_1 = ? OR userid_2 = ?', (userid, userid))
        else:
            return make_response('No query parameter provided', code=403)
        
        games = cur.fetchall()
        
        if games:
            return make_response('Games retrieved successfully', {'games': [dict(game) for game in games]})
        return make_response('No games found for this user or gameid', code=404)
    except sqlite3.Error as e:
        return make_response('Database error: ' + str(e), code=500)
    finally:
        conn.close()


#----------------------Socket Server----------------------
#Dictionaries for storing user session information
sid_mapper = {}
email_mapper = {}
sid_lock = threading.Lock()
email_lock = threading.Lock()

def get_email(sid):
    with email_lock:
        return email_mapper.get(sid)

def set_email(sid, email):
    with email_lock:
        email_mapper[sid] = email
        
waiting_players = {
    'Rapid': [],
    'Blitz': [],
    'Bullet': []
}
waiting_lock = threading.Lock()

active_games = {}  
active_lock = threading.Lock()

def get_sid(user):
    with sid_lock:
        return sid_mapper.get(user)

def set_sid(user, sid):
    with sid_lock:
        sid_mapper[user] = sid

def get_waiting_player(gameType):
    if gameType not in ['Blitz', 'Rapid', 'Bullet']:
        raise Exception("No such gameType")
    with waiting_lock:
        if waiting_players.get(gameType) and len(waiting_players.get(gameType)) > 0:
            return waiting_players.get(gameType).pop(0)
        return None

def set_waiting_player(player, gameType):
    with waiting_lock:
        if player not in waiting_players.get(gameType):
            waiting_players.get(gameType).append(player)
    
def generate_game_id():
    return str(uuid.uuid4())[:8]

class Game:
    def __init__(self, gameId, player1, player2, gameType):
        self.gameId = gameId
        self.player1 = player1  # White player
        self.player2 = player2  # Black player
        self.gameType = gameType
        
        game_times = {'Blitz': 300, 'Bullet': 180, 'Rapid': 600}
        self.player1_time = game_times[gameType]
        self.player2_time = game_times[gameType]
        
        self.is_game_active = False
        self.timer_thread = None
        self.board = chess.Board()
        self.last_move_time = None
        self.timer_lock = threading.Lock()
        

    def start_game(self):
        self.is_game_active = True
        self.last_move_time = time.time()  
        self.timer_thread = threading.Thread(target=self.update_timer)
        self.timer_thread.daemon = True
        self.timer_thread.start()  

    def move_piece(self, player, move):
        try:
            move_obj = chess.Move.from_uci(move)
            if move_obj not in self.board.legal_moves:
                emit('error', {"message": "Illegal move"}, to=get_sid(player))
                return False
                
            # Update timers based on who made the move
            with self.timer_lock:
                current_time = time.time()
                elapsed = int(current_time - self.last_move_time) if self.last_move_time else 0
                
                # Apply time deduction to the player who just moved
                if self.board.turn == chess.WHITE and player == self.player1:
                    self.player1_time = max(0, self.player1_time - elapsed)
                elif self.board.turn == chess.BLACK and player == self.player2:
                    self.player2_time = max(0, self.player2_time - elapsed)
                else:
                    # Wrong player tried to move
                    emit('error', {"message": "Not your turn"}, to=get_sid(player))
                    return False
                
                self.last_move_time = current_time
            
            # Execute the move
            self.board.push(move_obj)
            current_fen = self.board.fen()
            
            # Check game ending conditions
            if self.board.is_stalemate():
                self.game_over(None, 'Stalemate')
                return True
            elif self.board.is_checkmate():
                winner = self.player2 if self.board.turn == chess.WHITE else self.player1
                self.game_over(winner, 'Checkmate')
                return True
            elif self.board.is_insufficient_material():
                self.game_over(None, 'Insufficient Material')
                return True
            
            # Notify both players of the move
            response_data = {
                "move": str(move_obj),
                "fen": current_fen,
                "player1_time": self.player1_time,
                "player2_time": self.player2_time,
                "turn": "white" if self.board.turn == chess.WHITE else "black"
            }
            
            emit('move_made', response_data, to=get_sid(self.player1))
            emit('move_made', response_data, to=get_sid(self.player2))
            return True
            
        except Exception as e:
            print(f"Error processing move: {str(e)}")
            emit('error', {"message": f"Error processing move: {str(e)}"}, to=get_sid(player))
            return False

    def get_opponent(self, player):
        return self.player2 if player == self.player1 else self.player1

    def update_timer(self):
        while self.is_game_active:
            with self.timer_lock:
                current_time = time.time()
                if self.last_move_time:
                    elapsed = int(current_time - self.last_move_time)
                    
                    # Deduct time from current player
                    if self.board.turn == chess.WHITE:
                        if self.player1_time > 0:
                            self.player1_time = max(0, self.player1_time - 1)
                            if self.player1_time == 0:
                                self.game_over(self.player2, 'timeout')
                                break
                        else:
                            self.game_over(self.player2, 'timeout')
                            break
                    else:
                        if self.player2_time > 0:
                            self.player2_time = max(0, self.player2_time - 1)
                            if self.player2_time == 0:
                                self.game_over(self.player1, 'timeout')
                                break
                        else:
                            self.game_over(self.player1, 'timeout')
                            break
                    
                    # Send time updates every 5 seconds
                    if elapsed % 5 == 0:
                        time_update = {
                            "player1_time": self.player1_time,
                            "player2_time": self.player2_time
                        }
                        emit('time_update', time_update, to=get_sid(self.player1))
                        emit('time_update', time_update, to=get_sid(self.player2))
            
            time.sleep(1)
            
    def game_over(self, winner, reason):
        # Prevent race conditions with duplicate calls
        with self.timer_lock:
            if not self.is_game_active:
                return  # Prevent duplicate game_over calls
            
            # Mark game as inactive first to stop the timer thread
            self.is_game_active = False
        
        # Log game result
        print(f"Game {self.gameId} ended: {winner} won due to {reason}")
        
        # Prepare game result data
        result_data = {
            'winner': winner, 
            'reason': reason,
            'final_position': self.board.fen(),
            'game_type': self.gameType
        }
        
        # Notify both players
        player1_sid = get_sid(self.player1)
        player2_sid = get_sid(self.player2)
        
        if player1_sid:
            emit('game_over', result_data, to=player1_sid)
        if player2_sid:
            emit('game_over', result_data, to=player2_sid)
        
        # Store game result in database
        try:
           pass
        except Exception as e:
            print(f"Error initiating game save: {str(e)}")
        
        # Schedule removal of game after a delay to ensure all cleanup is complete
        def delayed_remove():
            time.sleep(5)  # Give time for all communications to finish
            with active_lock:
                if self.gameId in active_games:
                    active_games.pop(self.gameId, None)
                    print(f"Game {self.gameId} removed from active games")
        
        cleanup_thread = threading.Thread(target=delayed_remove)
        cleanup_thread.daemon = True
        cleanup_thread.start()       
def create_game(player1, player2, gameType):
    if player1 is None or player2 is None:
        print(f"Error: Attempted to create game with None player: {player1}, {player2}")
        return
        
    gameId = generate_game_id()
    
    # Randomly assign colors
    if random.random() < 0.5:
        white_player = player1
        black_player = player2
    else:
        white_player = player2
        black_player = player1
    
    print(f"Creating {gameType} game {gameId} between {white_player} (White) and {black_player} (Black)")
    
    with active_lock:
        game = Game(gameId, white_player, black_player, gameType)
        active_games[gameId] = game
        
    # Send game found events with correct opponent information
    try:
        emit('game_found', {
            "gameId": gameId, 
            "opponent": {"color": "black", "email": black_player}
        }, to=get_sid(white_player))
        
        emit('game_found', {
            "gameId": gameId, 
            "opponent": {"color": "white", "email": white_player}
        }, to=get_sid(black_player))
        
        # Start the game after sending notifications
        with active_lock:
            if gameId in active_games:
                active_games[gameId].start_game()
                
    except Exception as e:
        print(f"Error setting up game: {str(e)}")
        # Clean up if there was an error
        with active_lock:
            if gameId in active_games:
                del active_games[gameId]


@socketio.on('connect')
def handle_connect():
    try:
        email = get_email_from_token()
        set_sid(email, request.sid)
        set_email(request.sid, email)
        print(f"{email} connected")
    except:
        emit('error', {"message": "Authentication error"})
        return disconnect()

@socketio.on('join_game')
def handle_join_game(data):
    try:
        email = get_email(request.sid)
        gameType = data.get('gameType')
        
        if gameType not in ['Blitz', 'Rapid', 'Bullet']:
            raise Exception("Wrong game Type")
            
        # First check if there's a waiting player
        player = get_waiting_player(gameType)
        
        # If there's no waiting player or it's the same player, put in waiting queue
        if player is None:
            set_waiting_player(email, gameType)
            emit('waiting_for_opponent', to=request.sid)
            print(f"{email} now waiting for {gameType} game")
            return
        
        # Don't match player with themselves
        if player == email:
            set_waiting_player(email, gameType)
            emit('waiting_for_opponent', to=request.sid)
            print(f"{email} tried to match with self, put back in queue")
            return
            
        print(f"Matching {email} with {player} for {gameType} game")
        create_game(email, player, gameType)
    except Exception as e:
        emit("error", {"message": str(e)}, to=request.sid)
        print(f"Error in join_game: {str(e)}")

@socketio.on('stop_waiting_for_opponent')
def handle_stop_waiting(data):
    try:
        email = get_email(request.sid)
        gameType = data.get('gameType')
        
        if not gameType:
            print(f"Warning: No gameType provided in stop_waiting_for_opponent")
            # Try to remove from all queues
            with waiting_lock:
                for gt in waiting_players:
                    if email in waiting_players[gt]:
                        waiting_players[gt].remove(email)
                        print(f"Removed {email} from {gt} queue")
            return
            
        with waiting_lock:
            if email in waiting_players[gameType]:
                waiting_players[gameType].remove(email)
                print(f"Removed {email} from {gameType} queue")
    except Exception as e:
        print(f"Error in stop_waiting: {str(e)}")
        emit("error", {"message": str(e)}, to=request.sid)

@socketio.on('make_move')
def handle_make_move(data):
    try:
        email = get_email(request.sid)
        gameId = data.get('gameId')
        move_str = data.get('move')
        
        with active_lock:
            game = active_games.get(gameId)
            if not game:
                raise Exception("No game found with given game id")
                
            # Fixed: pass player email and move
            game.move_piece(email, move_str)
            
    except Exception as e:
        emit("error", {"message": str(e)}, to=request.sid)

@socketio.on('resign_game')
def handle_resign(data):
    try:
        email = get_email(request.sid)
        gameId = data.get('gameId')
        
        with active_lock:
            if gameId not in active_games:
                raise Exception("No game found")
                
            game = active_games[gameId]  # Fixed: accessing dict with []
            opponent = game.get_opponent(email)
            game.game_over(opponent, 'Resign')
    except Exception as e:
        emit("error", {"message": str(e)}, to=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    try:
        email = get_email(request.sid)
        
        # Check if in waiting queue
        for gameType in waiting_players:
            with waiting_lock:
                if email in waiting_players[gameType]:
                    waiting_players[gameType].remove(email)
                    return
                    
        # Check if in active game
        with active_lock:
            for gameId, game in list(active_games.items()):  # Fixed: iterate over items
                if game.player1 == email or game.player2 == email:
                    opponent = game.get_opponent(email)
                    game.game_over(opponent, 'Disconnection')
                    return 
            
    except Exception as e:
        print(f"Error in disconnect: {str(e)}")

@socketio.on('request_board_state')
def handle_request_board_state(data):
    try:
        email = get_email(request.sid)
        gameId = data.get('gameId')
        
        with active_lock:
            game = active_games.get(gameId)
            if not game:
                raise Exception("No game found with given game id")
            
            # Send the current FEN, board state, and time information
            response = {
                "fen": game.board.fen(),
                "player1_time": game.player1_time,
                "player2_time": game.player2_time,
                "turn": "white" if game.board.turn == chess.WHITE else "black"
            }
            
            emit('board_state_update', response, to=get_sid(email))
    except Exception as e:
        emit("error", {"message": str(e)}, to=request.sid)
        

# Token decoding function
def get_email_from_token():
    token = request.args.get('token')
    if not token:
        return 'anonymous@example.com'
    
    decoded = decode_token(token)
    return decoded.get('sub', 'anonymous@example.com')

if __name__ == '__main__':
    socketio.run(app, debug=True)