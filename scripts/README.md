# ClauseIQ Utility Scripts

This directory contains utility scripts for ClauseIQ system maintenance and debugging.

## Scripts

- **check_all_users.py** - Analyzes all users in the system and identifies cleanup targets
- **check_pinecone_docs.py** - Checks Pinecone vector database document storage 
- **clear_database.py** - Clears all documents, chat sessions, and vector data

## Running Scripts

These scripts require the backend dependencies. Run them with the backend virtual environment:

```bash
# From project root
cd backend && source venv/bin/activate && python3 ../scripts/script_name.py

# Or using the convenience commands:
cd backend && source venv/bin/activate
python3 ../scripts/check_all_users.py
python3 ../scripts/check_pinecone_docs.py  
python3 ../scripts/clear_database.py
```

The scripts automatically resolve the backend path and import necessary modules.

## Note

These scripts dynamically add the backend directory to Python's path, so they can access backend services and database connections from their new location in the scripts directory. 