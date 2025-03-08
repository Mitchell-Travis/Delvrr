# core/apps.py
from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    # def ready(self):
    #     import core.signals  # Import signals module here to register signals when the app is ready
