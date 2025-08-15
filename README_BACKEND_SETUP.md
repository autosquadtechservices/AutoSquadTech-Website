# Backend Setup and Features

## File Upload Handling
- Resume files are uploaded via the Application model's `resume` FileField.
- Uploaded files are stored in the `media/resumes/` directory.
- Ensure `MEDIA_ROOT` and `MEDIA_URL` are configured in `settings.py`:

```python
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

- Add media serving in `urls.py` during development:

```python
from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

## Basic Authentication for Admin Actions
- Admin panel is protected by Django's built-in authentication system.
- To create a superuser for admin access, run:

```bash
python manage.py createsuperuser
```

- For API authentication, you can enable Django REST Framework's authentication classes in `settings.py`:

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
}
```

- Protect sensitive API endpoints by adding appropriate permissions in views.

## Deployment Notes
- Use environment variables for sensitive settings like `SECRET_KEY`.
- For Heroku deployment, use `gunicorn` as WSGI server.
- Configure static and media files handling for production.
- Example Heroku deployment steps:

```bash
heroku create your-app-name
git push heroku main
heroku config:set DJANGO_SECRET_KEY='your-secret-key'
heroku run python manage.py migrate
heroku run python manage.py createsuperuser
```

- For AWS deployment, consider using Elastic Beanstalk or EC2 with similar setup.
