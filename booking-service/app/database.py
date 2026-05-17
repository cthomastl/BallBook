import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
import os
import logging

logger = logging.getLogger(__name__)

_pool: ThreadedConnectionPool = None


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/ballbook_bookings")
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=database_url)
        logger.info("Database connection pool created")
    return _pool


def get_connection():
    return get_pool().getconn()


def release_connection(conn):
    get_pool().putconn(conn)


def init_db():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bookings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    trainer_id VARCHAR(255) NOT NULL,
                    slot_id VARCHAR(255) NOT NULL,
                    date DATE NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    duration_minutes INTEGER NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'pending',
                    total_price NUMERIC(10, 2),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    notes TEXT
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bookings_trainer_id ON bookings(trainer_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);")
            conn.commit()
            logger.info("Database tables initialized successfully")
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to initialize database: {e}")
        raise
    finally:
        release_connection(conn)
