"""Persistence layer.

Everything the API stores goes through the repositories in `repositories.py`.
They currently keep data in process memory (`memory.py`), so all data is lost on restart.

TODO: Database — implement these repositories on a real database (PostgreSQL + SQLAlchemy
is the intended target), keep the same method signatures, and swap the instances
returned by `get_repositories()` in `repositories.py`. Nothing outside `app/db` should
need to change.
"""
