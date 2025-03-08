from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from accounts.models import User


class UserModelAdmin(UserAdmin):
    list_display = ('username', 'email', 'date_joined', 'last_login', 'is_admin', 'is_staff')
    search_fields = ('email', 'username',)
    readonly_fields = ('id', 'date_joined', 'last_login')

    filter_horizontal = ()
    list_filter = ()
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'profile_image')}),
        ('Permissions', {'fields': ('is_admin', 'is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
    )



admin.site.register(User, UserModelAdmin)
admin.site.site_title = 'Snap Menu'
admin.site.site_header = 'Snap Menu'