import datetime
import jwt
import os
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Get the secret key from the environment
SECRET_KEY = os.getenv('JWT_SECRET_KEY')

# Function to create a JWT token
def create_jwt_token(username):
    expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=1)  # Token expiration (1 hour)
    payload = {
        'user': username,  # Add your claims here
        'exp': expiration   # Expiration time for the token
    }
    # Encode the payload and create the token
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return {'token': token}

# Function to decode a JWT token
def decode_jwt_token(token):
    try:
        # Decode the token and verify its validity using the SECRET_KEY
        decoded_payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return decoded_payload
    except jwt.ExpiredSignatureError:
        return {'error': 'Token has expired'}
    except jwt.InvalidTokenError:
        return {'error': 'Invalid token'}
