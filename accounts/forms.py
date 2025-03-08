from django import forms

class RegistrationForm(forms.Form):
    username = forms.CharField(max_length=30, required=True)
    phone_number = forms.CharField(max_length=15, required=True)

class OTPForm(forms.Form):
    otp = forms.CharField(max_length=6, required=True)
