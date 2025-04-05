from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('menu_dashboard', '0040_alter_product_charge_gst'),
    ]
    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='slug',
            field=models.SlugField(max_length=255, null=True, blank=True),
        ),

    ]