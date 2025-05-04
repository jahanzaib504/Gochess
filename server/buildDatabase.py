import sqlite3

conn = sqlite3.connect('chess.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.executescript("""
CREATE TABLE IF NOT EXISTS user (
    userid INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    joined_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_history (
    gameid INTEGER PRIMARY KEY AUTOINCREMENT,
    userid_1 INTEGER NOT NULL,
    userid_2 INTEGER NOT NULL,
    time_control TEXT,
    result INTEGER NOT NULL, -- 0 
    pgn TEXT NOT NULL,
    date_of_game DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid_1) REFERENCES user(userid),
    FOREIGN KEY (userid_2) REFERENCES user(userid)
);

CREATE VIEW IF NOT EXISTS USER_VIEW AS
    SELECT userid, username, email, joined_date FROM user;
    
CREATE VIEW IF NOT EXISTS GAME_VIEW AS 
    SELECT
        gh.gameid AS gameid,
        u1.username AS username_1,
        u2.username AS username_2,
        u1.userid as userid_1,
        u2.userid as userid_2,
        gh.time_control,
        gh.result,
        gh.pgn,
        gh.date_of_game
    FROM
        game_history gh
    JOIN user u1 ON gh.userid_1 = u1.userid
    JOIN user u2 ON gh.userid_2 = u2.userid;

-- Trigger to validate user before insert
CREATE TRIGGER IF NOT EXISTS validate_user_before_insert
BEFORE INSERT ON user
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.username IS NULL OR NEW.username = ''
        THEN RAISE(ABORT, 'Username cannot be NULL or empty')
    END;
    
    SELECT CASE
        WHEN NEW.email IS NULL OR NEW.email = ''
        THEN RAISE(ABORT, 'Email cannot be NULL or empty')
    END;

    SELECT CASE
        WHEN NEW.password IS NULL OR NEW.password = ''
        THEN RAISE(ABORT, 'Password cannot be NULL or empty')
    END;
END;

-- Trigger to validate user before update
CREATE TRIGGER IF NOT EXISTS validate_user_before_update
BEFORE UPDATE ON user
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.username IS NULL OR NEW.username = ''
        THEN RAISE(ABORT, 'Username cannot be NULL or empty on update')
    END;
    
    SELECT CASE
        WHEN NEW.email IS NULL OR NEW.email = ''
        THEN RAISE(ABORT, 'Email cannot be NULL or empty on update')
    END;

    SELECT CASE
        WHEN NEW.password IS NULL OR NEW.password = ''
        THEN RAISE(ABORT, 'Password cannot be NULL or empty on update')
    END;
END;
""")

conn.commit()
conn.close()