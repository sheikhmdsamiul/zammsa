#!/bin/sh
set -e

if [ "$1" = "gunicorn" ]; then
    echo "Running database migrations..."
    python manage.py migrate --noinput

    echo "Loading initial data..."
    python manage.py loaddata initial_data 2>/dev/null || echo "Initial data already loaded (skipping)"

    echo "Seeding test users..."
    python manage.py seed_test_users

    echo "Setting up budget allocations..."
    python manage.py set_budgets --amount 5000000

    echo "Seeding Contract Procurement Plans..."
    python manage.py seed_cpp

    echo "Collecting static files..."
    python manage.py collectstatic --noinput --clear
fi

exec "$@"
