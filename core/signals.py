# from django.db.models.signals import post_save
# from django.dispatch import receiver
# from .models import Restaurant, Table

# @receiver(post_save, sender=Restaurant)
# def create_tables_for_restaurant(sender, instance, created, **kwargs):
#     if created:
#         # Create tables for the restaurant here
#         for table_number in range(1, 11):  # You can adjust the range as needed
#             Table.objects.create(restaurant=instance, table_number=table_number)