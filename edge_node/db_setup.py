import sqlite3
import pandas as pd
import numpy as np
from sklearn.datasets import make_classification
import os

def initialize_db(db_name="local_vitals.db"):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patient_vitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Age REAL, RestingBP REAL, Cholesterol REAL,
            MaxHR REAL, ST_Depression REAL, ChestPain_Type INTEGER,
            ExerciseAngina INTEGER, Target INTEGER
        )
    ''')

    # Generate synthetic edge dataset
    X, y = make_classification(n_samples=300, n_features=7, n_informative=5, random_state=int(os.getenv("RANDOM_SEED", 42)))
    
    # Scale to medical ranges
    X[:, 0] = np.interp(X[:, 0], (X[:, 0].min(), X[:, 0].max()), (30, 80))    
    X[:, 1] = np.interp(X[:, 1], (X[:, 1].min(), X[:, 1].max()), (95, 180))   
    X[:, 2] = np.interp(X[:, 2], (X[:, 2].min(), X[:, 2].max()), (140, 360))  
    X[:, 3] = np.interp(X[:, 3], (X[:, 3].min(), X[:, 3].max()), (80, 200))   
    X[:, 4] = np.interp(X[:, 4], (X[:, 4].min(), X[:, 4].max()), (0.0, 5.0))  
    X[:, 5] = np.digitize(X[:, 5], bins=np.linspace(X[:, 5].min(), X[:, 5].max(), 4)) - 1
    X[:, 6] = (X[:, 6] > 0).astype(int)

    df = pd.DataFrame(X, columns=['Age', 'RestingBP', 'Cholesterol', 'MaxHR', 'ST_Depression', 'ChestPain_Type', 'ExerciseAngina'])
    df['Target'] = y
    
    df.to_sql('patient_vitals', conn, if_exists='replace', index=False)
    conn.close()
    print(f"Database {db_name} initialized for {os.getenv('NODE_NAME', 'Node')}")

if __name__ == "__main__":
    initialize_db()
