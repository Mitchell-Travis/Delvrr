from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser, BaseUserManager, PermissionsMixin, Group
)
from PIL import Image
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid


# Custom User Model

class UserManager(BaseUserManager):
    def create_user(self, email=None, username=None, password=None):
        if not username:
            raise ValueError('Users must have a username')
        
        if email is None:
            email = f'{username}@example.com'

        user = self.model(
            email=self.normalize_email(email),
            username=username,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None):
        user = self.create_user(
            email=email,
            username=username,
            password=password,
        )
        user.is_admin = True
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


# The filepath to the profile image
def get_profile_image_filepath(self, filename):
    return 'profile_images/' + str(self.pk) + '/profile_image.jpg'


# for default profile image
def get_default_profile_image():
    return "default.jpg"


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(verbose_name='email', max_length=30, unique=True, null=True, blank=True)
    username = models.CharField(max_length=30, verbose_name='username', unique=False)
    first_name = models.CharField(max_length=30, verbose_name='first name', null=True, blank=True)
    last_name = models.CharField(max_length=30, verbose_name='last name', null=True, blank=True)
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    last_login = models.DateTimeField(verbose_name='last login', auto_now_add=True)
    date_joined = models.DateTimeField(verbose_name='date joined', auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    hide_email = models.BooleanField(default=True)
    profile_image = models.ImageField(max_length=230, upload_to='profile_images/', default='default.jpg', blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    def __str__(self):
        return self.username

    def has_perm(self, perm, obj=None):
        return self.is_admin

    def has_module_perms(self, app_label):
        return self.is_admin


# Model for sending email confirmation code
class ConfirmationCode(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, db_constraint=False, blank=True, null=True)
    confirmed_code = models.CharField(max_length=30)

    def __str__(self):
        return self.confirmed_code


# Model for verifying the confirmation code
class VerifyConfirmation(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, db_constraint=False, blank=True, null=True)
    verified_code = models.CharField(max_length=30)

    def __str__(self):
        return self.verified_code


# Create your models here.
class Profile(models.Model):
    user=models.OneToOneField(User,   on_delete=models.CASCADE,related_name="profile")
    phone_number=models.CharField(max_length=15)
    otp=models.CharField(max_length=100,null=True,blank=True)
    uid=models.CharField(default=f'{uuid.uuid4}',max_length=200)



