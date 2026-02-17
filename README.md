# BizbenSayahatta


The project is split into two main folders:
- `back/` — backend (Django)
- `front/` — frontend (React)

---

## Backend (Django)

### Tech stack
- Python
- Django
- Django REST Framework
- Other dependencies are listed in `requirements-base.txt`

### Setup backend

1. Go to backend folder:
cd back

Create virtual environment:
python -m venv venv

Activate virtual environment:
macOS / Linux
source venv/bin/activate

Windows
venv\Scripts\activate

Install dependencies:
pip install Pillow
pip install -r requirements-base.txt

Apply migrations:
python manage.py makemigrations
python manage.py migrate

Run server:
python manage.py runserver

Backend will run on:
http://127.0.0.1:8000/

## Frontend (React)
Tech stack
React
JavaScript

npm or yarn

### Setup frontend
Go to frontend folder:
cd front

Install dependencies:
npm install
npm install react-simple-maps --legacy-peer-deps


Run frontend:
npm run dev
npm install react-leaflet leaflet


Frontend will run on:
http://localhost:5174/

Environment Variables
If your project uses environment variables:

Backend: create .env file inside back/
Do not commit .env files to git.


Author
Project developed by Dina Abitova
