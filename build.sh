#!/usr/bin/env bash
# Exit on error
set -o errexit
# Install dependencies
pip3 install -r requirements.txt
# Collect static files
python3 manage.py collectstatic --no-input
# Apply any outstanding database migrations
python3 manage.py migrate --noinput
# Start the application
gunicorn snap_menu.wsgi:application --bind 0.0.0.0:$PORT