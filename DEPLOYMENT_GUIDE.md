# Deployment Guide for AutoSquad Backend

## Deployment Options

### 1. **Heroku (Recommended for beginners)**
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create new app
heroku create autosquad-backend

# Add buildpacks
heroku buildpacks:add heroku/python
heroku buildpacks:add heroku/nodejs

# Set environment variables
heroku config:set DJANGO_SECRET_KEY=your-secret-key-here
heroku config:set DEBUG=False
heroku config:set ALLOWED_HOSTS=autosquad-backend.herokuapp.com

# Deploy
git add .
git commit -m "Initial deployment"
git push heroku main

# Run migrations
heroku run python manage.py migrate
heroku run python manage.py createsuperuser
```

### 2. **AWS EC2 (Production-ready)**
```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install dependencies
sudo yum update -y
sudo yum install python3 python3-pip nginx -y

# Clone repository
git clone https://github.com/your-repo/autosquad-backend.git
cd autosquad-backend

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure Gunicorn
pip install gunicorn
sudo cp deploy/nginx.conf /etc/nginx/conf.d/autosquad.conf
sudo systemctl restart nginx

# Setup systemd service
sudo cp deploy/gunicorn.service /etc/systemd/system/autosquad.service
sudo systemctl enable autosquad
sudo systemctl start autosquad
```

### 3. **DigitalOcean App Platform**
```bash
# Create app.yaml
name: autosquad-backend
region: nyc
services:
  - name: web
    source_dir: backend
    environment_slug: python
    run_command: gunicorn jobportal_project.wsgi:application
    envs:
      - key: DJANGO_SECRET_KEY
        scope: RUN
        value: your-secret-key
      - key: DEBUG
        scope: RUN
        value: "False"
```

### 4. **Railway (Modern cloud platform)**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
railway domain
```

### 5. **Vercel (Serverless)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Environment Variables Setup
```bash
# Required for all deployments
DJANGO_SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
DATABASE_URL=your-database-url

# Optional
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

## Database Setup
```bash
# PostgreSQL (Recommended for production)
pip install psycopg2-binary

# Update settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT'),
    }
}
```

## SSL Certificate Setup
```bash
# Using Let's Encrypt
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Monitoring & Logging
```bash
# Install monitoring tools
pip install django-prometheus
pip install sentry-sdk

# Add to settings.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[DjangoIntegration()],
    traces_sample_rate=1.0
)
```

## Quick Start Commands
```bash
# Local development
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Production
gunicorn jobportal_project.wsgi:application --bind 0.0.0.0:8000
```

## Choose Your Deployment:
1. **Heroku** - Easiest for beginners
2. **AWS EC2** - Most control and cost-effective
3. **DigitalOcean** - Good balance of simplicity and control
4. **Railway** - Modern and developer-friendly
5. **Vercel** - Serverless with automatic scaling

All deployment configurations are ready in the backend directory. Choose based on your needs and technical expertise.
