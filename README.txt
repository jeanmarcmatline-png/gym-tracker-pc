# Gym Tracker — Installation

## Prérequis
- Python 3.x installé (Microsoft Store ou python.org)
- Google Chrome

## Installation (une seule fois)
1. Dézippe le dossier `gym_app` où tu veux (ex: `C:\Users\Jean-Marc\gym_app`)
2. Double-clique sur `lancer.bat`
3. Flask s'installe automatiquement si besoin
4. Ouvre Chrome sur http://localhost:5000

## Utilisation quotidienne
1. Double-clique `lancer.bat`
2. Chrome s'ouvre sur l'application
3. À la fin : ferme Chrome, puis ferme la fenêtre noire (Ctrl+C)

## Données
- Stockées dans `gym.db` (SQLite) — fichier dans le dossier gym_app
- Pour sauvegarder : copie `gym.db` sur OneDrive ou une clé USB
- Pour restaurer : remplace `gym.db` par ta sauvegarde

## Structure
gym_app/
├── app.py          ← Application Flask
├── gym.db          ← Base de données (créée au premier lancement)
├── lancer.bat      ← Double-clique pour démarrer
└── templates/
    └── index.html  ← Interface web
