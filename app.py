from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sqlite3, json, os
from datetime import datetime

app = Flask(__name__)
CORS(app)
DB = os.path.join(os.path.dirname(__file__), 'gym.db')

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            muscle_group TEXT NOT NULL,
            type TEXT DEFAULT 'strength',
            is_compound INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            days_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cycle_id INTEGER NOT NULL,
            day_index INTEGER NOT NULL,
            date TEXT NOT NULL,
            feeling INTEGER DEFAULT 2,
            note TEXT DEFAULT '',
            data_json TEXT NOT NULL
        );
    ''')
    count = conn.execute('SELECT COUNT(*) FROM exercises').fetchone()[0]
    if count == 0:
        seed_exercises(conn)
    conn.commit()
    conn.close()

def seed_exercises(conn):
    data = [
        ('Developpé incliné machine','Pectoraux','strength',0),
        ('Developpé couché machine','Pectoraux','strength',0),
        ('Developpé couché haltères','Pectoraux','strength',0),
        ('Ecarté machine','Pectoraux','strength',0),
        ('Ecarté haltères','Pectoraux','strength',0),
        ('Dips','Pectoraux','strength',0),
        ('Tirage poitrine','Dos','strength',0),
        ('Rowing machine','Dos','strength',0),
        ('Pull-over poulie haute','Dos','strength',0),
        ('Traction','Dos','strength',0),
        ('Rowing barre','Dos','strength',1),
        ("Soulevé d'épaule (shrug)",'Dos','strength',0),
        ('Developpé épaules machine','Epaules','strength',0),
        ('Developpé épaules haltères','Epaules','strength',0),
        ('Elevation latérale haltères','Epaules','strength',0),
        ('Arrière épaule machine','Epaules','strength',0),
        ('Elevation frontale','Epaules','strength',0),
        ('Face pull poulie','Epaules','strength',0),
        ('Curl barre Z','Biceps','strength',0),
        ('Curl marteau','Biceps','strength',0),
        ('Curl poulie vis-à-vis','Biceps','strength',0),
        ('Curl incliné haltères','Biceps','strength',0),
        ('Extension poulie basse','Triceps','strength',0),
        ('Extension poulie haute','Triceps','strength',0),
        ('Developpé serré','Triceps','strength',1),
        ('Dips triceps','Triceps','strength',0),
        ('Squat machine','Jambes','strength',0),
        ('Presse pieds bas','Jambes','strength',0),
        ('Presse pieds haut','Jambes','strength',0),
        ('Leg extension','Jambes','strength',0),
        ('Leg curl couché','Jambes','strength',0),
        ('Fentes haltères','Jambes','strength',1),
        ('Mollets debout','Mollets','strength',0),
        ('Mollets assis','Mollets','strength',0),
        ('Trap bar deadlift','Polyarticulaires','strength',1),
        ('Soulevé de terre conventionnel','Polyarticulaires','strength',1),
        ('Squat barre','Polyarticulaires','strength',1),
        ('Marche du fermier bilatérale','Polyarticulaires','strength',1),
        ('Marche du fermier unilatérale','Polyarticulaires','strength',1),
        ('Developpé couché barre','Polyarticulaires','strength',1),
        ('Vélo stationnaire Zone 2','Cardio','cardio_z2',0),
        ('Elliptique Zone 2','Cardio','cardio_z2',0),
        ('Marche rapide Zone 2','Cardio','cardio_z2',0),
        ('Rameur Zone 2','Cardio','cardio_z2',0),
        ('HIIT vélo','Cardio','hiit',0),
        ('HIIT elliptique','Cardio','hiit',0),
        ('HIIT rameur','Cardio','hiit',0),
        ('Gainage planche','Core','strength',0),
        ('Crunch machine','Core','strength',0),
        ('Relevé de jambes','Core','strength',0),
    ]
    conn.executemany('INSERT INTO exercises (name,muscle_group,type,is_compound) VALUES (?,?,?,?)', data)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/exercises', methods=['GET'])
def get_exercises():
    conn = get_db()
    rows = conn.execute('SELECT * FROM exercises ORDER BY muscle_group,name').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/exercises', methods=['POST'])
def add_exercise():
    d = request.json
    conn = get_db()
    cur = conn.execute('INSERT INTO exercises (name,muscle_group,type,is_compound) VALUES (?,?,?,?)',
        (d['name'], d['muscle_group'], d.get('type','strength'), d.get('is_compound',0)))
    new_id = cur.lastrowid
    conn.commit(); conn.close()
    return jsonify({'ok':True,'id':new_id})

@app.route('/api/exercises/<int:eid>', methods=['DELETE'])
def del_exercise(eid):
    conn = get_db()
    conn.execute('DELETE FROM exercises WHERE id=?',(eid,))
    conn.commit(); conn.close()
    return jsonify({'ok':True})

@app.route('/api/cycles', methods=['GET'])
def get_cycles():
    conn = get_db()
    rows = conn.execute('SELECT id,name,created_at FROM cycles ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/cycles', methods=['POST'])
def save_cycle():
    d = request.json
    conn = get_db()
    if d.get('id'):
        conn.execute('UPDATE cycles SET name=?,days_json=? WHERE id=?',
            (d['name'], json.dumps(d['days']), d['id']))
        cid = d['id']
    else:
        cur = conn.execute('INSERT INTO cycles (name,created_at,days_json) VALUES (?,?,?)',
            (d['name'], datetime.now().strftime('%Y-%m-%d'), json.dumps(d['days'])))
        cid = cur.lastrowid
    conn.commit(); conn.close()
    return jsonify({'ok':True,'id':cid})

@app.route('/api/cycles/<int:cid>', methods=['GET'])
def get_cycle(cid):
    conn = get_db()
    row = conn.execute('SELECT * FROM cycles WHERE id=?',(cid,)).fetchone()
    conn.close()
    if not row: return jsonify({'error':'not found'}),404
    d = dict(row); d['days'] = json.loads(d['days_json'])
    return jsonify(d)

@app.route('/api/cycles/<int:cid>', methods=['DELETE'])
def del_cycle(cid):
    conn = get_db()
    conn.execute('DELETE FROM cycles WHERE id=?',(cid,))
    conn.execute('DELETE FROM sessions WHERE cycle_id=?',(cid,))
    conn.commit(); conn.close()
    return jsonify({'ok':True})

@app.route('/api/cycles/<int:cid>/composition')
def cycle_composition(cid):
    conn = get_db()
    cycle = conn.execute('SELECT * FROM cycles WHERE id=?',(cid,)).fetchone()
    if not cycle: conn.close(); return jsonify({'error':'not found'}),404
    days = json.loads(cycle['days_json'])
    exos = {str(r['id']): dict(r) for r in conn.execute('SELECT * FROM exercises').fetchall()}
    conn.close()
    tl = {'strength':'Musculation','cardio_z2':'Cardio Zone 2','hiit':'HIIT'}
    L = ['=== COMPOSITION DU CYCLE — JEAN-MARC ===',
         'Programme : {} ({} jours)'.format(cycle['name'], len(days)),
         'Généré le : {}'.format(datetime.now().strftime('%d/%m/%Y')),'',
         '--- STRUCTURE ---','']
    for i,day in enumerate(days):
        ids = day.get('exercise_ids',[])
        if not ids:
            L.append('J{} — {} : REPOS'.format(i+1, day['name']))
        else:
            L.append('J{} — {}'.format(i+1, day['name']))
            by_grp = {}
            for eid in ids:
                ex = exos.get(str(eid))
                if not ex: continue
                by_grp.setdefault(ex['muscle_group'],[]).append(ex)
            for grp,exlist in by_grp.items():
                L.append('  [{}]'.format(grp))
                for ex in exlist:
                    L.append('    - {} ({})'.format(ex['name'], tl.get(ex['type'],ex['type'])))
        L.append('')
    L += ['--- CONTEXTE PERSONNEL ---',
          'Age : 67 ans | Séances à 6h15 le matin',
          'Objectif : maintien de la force + hypertrophie (anti-sarcopénie)',
          "Structure : 1 série lourde 5-6 reps + 3 séries x10 à l'échec",
          'Sensibilité lombaire | Trap bar deadlift : 110 kg | Zone 2 cible : 101-118 bpm','',
          '--- QUESTIONS POUR CLAUDE ---',
          '1. Equilibre des groupes musculaires (agonistes/antagonistes) ?',
          '2. Répartition de la charge — récupération suffisante ?',
          '3. Risques de surentraînement compte tenu de mon profil ?',
          '4. Améliorations suggérées ?']
    return jsonify({'composition':'\n'.join(L)})

@app.route('/api/sessions', methods=['POST'])
def save_session():
    d = request.json
    conn = get_db()
    ex = conn.execute('SELECT id FROM sessions WHERE cycle_id=? AND day_index=? AND date=?',
        (d['cycle_id'],d['day_index'],d['date'])).fetchone()
    if ex:
        conn.execute('UPDATE sessions SET feeling=?,note=?,data_json=? WHERE id=?',
            (d['feeling'],d['note'],json.dumps(d['data']),ex['id']))
    else:
        conn.execute('INSERT INTO sessions (cycle_id,day_index,date,feeling,note,data_json) VALUES (?,?,?,?,?,?)',
            (d['cycle_id'],d['day_index'],d['date'],d['feeling'],d['note'],json.dumps(d['data'])))
    conn.commit(); conn.close()
    return jsonify({'ok':True})

@app.route('/api/sessions/by-date')
def session_by_date():
    """Retourne toutes les sessions d'une date donnée pour un cycle."""
    cid = request.args.get('cycle_id')
    dt  = request.args.get('date')
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM sessions WHERE cycle_id=? AND date=? ORDER BY day_index',
        (cid, dt)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d['data'] = json.loads(d['data_json'])
        result.append(d)
    return jsonify(result)

@app.route('/api/sessions/exact')
def exact_session():
    cid = request.args.get('cycle_id')
    di  = request.args.get('day_index')
    dt  = request.args.get('date')
    conn = get_db()
    row = conn.execute('SELECT * FROM sessions WHERE cycle_id=? AND day_index=? AND date=?',
        (cid, di, dt)).fetchone()
    conn.close()
    if not row: return jsonify(None)
    d = dict(row); d['data'] = json.loads(d['data_json'])
    return jsonify(d)

@app.route('/api/sessions/last')
def last_session():
    cid = request.args.get('cycle_id')
    di = request.args.get('day_index')
    conn = get_db()
    row = conn.execute('SELECT * FROM sessions WHERE cycle_id=? AND day_index=? ORDER BY date DESC LIMIT 1',
        (cid,di)).fetchone()
    conn.close()
    if not row: return jsonify(None)
    d = dict(row); d['data'] = json.loads(d['data_json'])
    return jsonify(d)

@app.route('/api/sessions/history')
def history():
    cid = request.args.get('cycle_id')
    conn = get_db()
    rows = conn.execute('SELECT * FROM sessions WHERE cycle_id=? ORDER BY date DESC LIMIT 90',(cid,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r); d['data'] = json.loads(d['data_json']); result.append(d)
    return jsonify(result)

@app.route('/api/sessions/progression')
def progression():
    cid = request.args.get('cycle_id')
    conn = get_db()
    rows = conn.execute('SELECT * FROM sessions WHERE cycle_id=? ORDER BY date ASC',(cid,)).fetchall()
    exos = {str(r['id']): r['name'] for r in conn.execute('SELECT id,name FROM exercises').fetchall()}
    conn.close()
    by_ex = {}
    for r in rows:
        data = json.loads(r['data_json'])
        for ex_id, series in data.items():
            if not isinstance(series, list): continue
            valid = [s for s in series if (float(s.get('weight') or 0) > 0 or int(s.get('reps') or 0) > 0)]
            if not valid: continue
            # Charge max S1 (force)
            s1 = valid[0] if valid else {}
            max_w = float(s1.get('weight') or 0)
            # Tonnage total = somme(poids × reps) toutes séries
            tonnage = sum(
                float(s.get('weight') or 0) * int(s.get('reps') or 0)
                for s in valid
            )
            if max_w == 0 and tonnage == 0: continue
            k = str(ex_id)
            if k not in by_ex:
                by_ex[k] = {'name': exos.get(k, k), 'points': []}
            by_ex[k]['points'].append({
                'date': r['date'],
                'max_w': max_w,
                'tonnage': round(tonnage)
            })
    return jsonify(by_ex)

@app.route('/api/report')
def report():
    cid = request.args.get('cycle_id')
    conn = get_db()
    cycle = conn.execute('SELECT * FROM cycles WHERE id=?',(cid,)).fetchone()
    sessions_rows = conn.execute('SELECT * FROM sessions WHERE cycle_id=? ORDER BY date DESC LIMIT 90',(cid,)).fetchall()
    exos = {str(r['id']): dict(r) for r in conn.execute('SELECT * FROM exercises').fetchall()}
    conn.close()
    if not cycle: return jsonify({'error':'not found'}),404
    days = json.loads(cycle['days_json'])
    fl = {1:'Difficile',2:'Normal',3:'Super'}
    L = ['=== RAPPORT ENTRAINEMENT — JEAN-MARC ===',
        'Généré le : {}'.format(datetime.now().strftime('%d/%m/%Y %H:%M')),
        'Cycle : {}'.format(cycle['name']),'','--- STRUCTURE ---']
    for i,day in enumerate(days):
        names = [exos[str(eid)]['name'] for eid in day.get('exercise_ids',[]) if str(eid) in exos]
        L.append('  J{} — {} : {}'.format(i+1, day['name'], ', '.join(names) or 'Repos'))
    L += ['','--- SEANCES ---','']
    for s in sessions_rows:
        data = json.loads(s['data_json'])
        day = days[s['day_index']] if s['day_index'] < len(days) else {}
        L.append('[{}] J{} — {} | Forme : {}'.format(
            s['date'], s['day_index']+1, day.get('name',''), fl.get(s['feeling'],'Normal')))
        for ex_id, series in data.items():
            if not isinstance(series, list): continue
            ex = exos.get(str(ex_id),{})
            valid = [sd for sd in series if (float(sd.get('weight') or 0) > 0 or int(sd.get('reps') or 0) > 0)]
            if not valid: continue
            # Détail des séries
            for j,sd in enumerate(valid):
                w = sd.get('weight',''); r2 = sd.get('reps','')
                star = '[*] ' if (ex.get('is_compound') and j==0) else '    '
                L.append('  {}{}  S{}: {}kg x {}reps'.format(star, ex.get('name',ex_id), j+1, w, r2))
            # Calcul tonnage et charge max S1
            s1_w = float(valid[0].get('weight') or 0)
            s1_r = int(valid[0].get('reps') or 0)
            tonnage = sum(float(sd.get('weight') or 0) * int(sd.get('reps') or 0) for sd in valid)
            detail_parts = []
            for j,sd in enumerate(valid):
                w2 = float(sd.get('weight') or 0)
                r2 = int(sd.get('reps') or 0)
                if w2 and r2:
                    detail_parts.append('{}x{}'.format(w2,r2))
            detail_str = ' + '.join(detail_parts) + ' = {}kg'.format(round(tonnage)) if detail_parts else ''
            L.append('  >>> Charge max S1: {}kg | Tonnage total: {}kg [{}]'.format(
                s1_w, round(tonnage), detail_str))
        if s['note']: L.append('  Note: {}'.format(s['note']))
        L.append('')
    L.append('--- PROGRESSIONS ---')
    L.append('  Méthode : charge max S1 (force) + tonnage total (volume = somme poids x reps)')
    L.append('  Tonnage = S1(poids x reps) + S2(poids x reps) + ... sur toutes les séries renseignées')
    L.append('')
    by_ex_force = {}
    by_ex_tonnage = {}
    for s in sessions_rows:  # déjà trié DESC, on inverse
        data = json.loads(s['data_json'])
        for ex_id, series in data.items():
            if not isinstance(series,list): continue
            valid = [sd for sd in series if float(sd.get('weight') or 0) > 0]
            if not valid: continue
            s1_w = float(valid[0].get('weight') or 0)
            tonnage = sum(float(sd.get('weight') or 0) * int(sd.get('reps') or 0) for sd in valid)
            if ex_id not in by_ex_force:
                by_ex_force[ex_id] = []
                by_ex_tonnage[ex_id] = []
            by_ex_force[ex_id].append({'date': s['date'], 'val': s1_w})
            by_ex_tonnage[ex_id].append({'date': s['date'], 'val': round(tonnage)})
    # Inverser pour avoir chronologique
    for k in by_ex_force:
        by_ex_force[k].reverse()
        by_ex_tonnage[k].reverse()
    hp = False
    for ex_id in by_ex_force:
        wf = by_ex_force[ex_id]
        wt = by_ex_tonnage[ex_id]
        if len(wf) < 2: continue
        name = exos.get(str(ex_id),{}).get('name', ex_id)
        diff_f = wf[-1]['val'] - wf[0]['val']
        diff_t = wt[-1]['val'] - wt[0]['val']
        sf = '+' if diff_f >= 0 else ''
        st = '+' if diff_t >= 0 else ''
        L.append('  {}'.format(name))
        L.append('    Force  (S1 max) : {}kg -> {}kg ({}{})'.format(wf[0]['val'], wf[-1]['val'], sf, diff_f))
        L.append('    Tonnage (total) : {}kg -> {}kg ({}{})'.format(wt[0]['val'], wt[-1]['val'], st, diff_t))
        hp = True
    if not hp: L.append('  Données insuffisantes (au moins 2 séances nécessaires).')
    L += ['','--- CONTEXTE ---',
        "Structure : 1 série lourde 5-6 reps (*) + 3 séries x10 à l'échec",
        'Trap bar : 110kg | 6h15 matin | Sensibilité lombaire | Zone 2 cible 101-118bpm']
    return jsonify({'report':'\n'.join(L)})


@app.route('/api/ping')
def ping():
    return jsonify({'ok': True, 'server': 'Gym Tracker PC'})

@app.route('/api/export-mobile')
def export_mobile():
    """Génère le fichier config pour l'app mobile."""
    conn = get_db()
    # Tous les exercices
    exercises = [dict(r) for r in conn.execute('SELECT * FROM exercises ORDER BY muscle_group,name').fetchall()]
    # Tous les cycles
    cycles_rows = conn.execute('SELECT * FROM cycles ORDER BY id DESC').fetchall()
    cycles = []
    for row in cycles_rows:
        c2 = dict(row)
        c2['days'] = json.loads(c2['days_json'])
        cycles.append(c2)
    # Dernières valeurs par exercice (toutes séances confondues)
    last_values = {}
    sessions = conn.execute('SELECT * FROM sessions ORDER BY date DESC').fetchall()
    for s in sessions:
        data = json.loads(s['data_json'])
        for ex_id, series in data.items():
            if ex_id not in last_values and isinstance(series, list):
                valid = [sd for sd in series if float(sd.get('weight') or 0) > 0 or int(sd.get('reps') or 0) > 0]
                if valid:
                    last_values[ex_id] = {
                        'date': s['date'],
                        'sets': valid
                    }
    conn.close()
    payload = {
        'version': '1.0',
        'exported_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'exercises': exercises,
        'cycles': cycles,
        'last_values': last_values
    }
    from flask import Response
    return Response(
        json.dumps(payload, ensure_ascii=False, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': 'attachment; filename=config_mobile_{}.json'.format(
            datetime.now().strftime('%Y%m%d_%H%M')
        )}
    )


@app.route('/api/import-session', methods=['POST'])
def import_session():
    if 'file' not in request.files:
        return jsonify({'ok': False, 'error': 'Aucun fichier'}), 400
    f = request.files['file']
    try:
        raw = json.loads(f.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'ok': False, 'error': 'JSON invalide: {}'.format(str(e))}), 400

    # Accepter les deux formats : fichier multi-séances (export mobile) ou séance unique
    if raw.get('export_type') == 'gym_mobile_sessions':
        sess_dict = raw.get('sessions', {})
    else:
        # Format legacy séance unique
        sess_dict = {'legacy': raw}

    conn = get_db()
    imported = 0
    updated = 0
    errors = []

    for key, sess in sess_dict.items():
        required = ['cycle_id','day_index','date','feeling','note','data']
        missing = [r for r in required if r not in sess]
        if missing:
            errors.append('Clé {}: champs manquants {}'.format(key, missing))
            continue
        cycle = conn.execute('SELECT id FROM cycles WHERE id=?', (sess['cycle_id'],)).fetchone()
        if not cycle:
            errors.append('Cycle {} introuvable'.format(sess['cycle_id']))
            continue
        existing = conn.execute(
            'SELECT id FROM sessions WHERE cycle_id=? AND day_index=? AND date=?',
            (sess['cycle_id'], sess['day_index'], sess['date'])
        ).fetchone()
        if existing:
            conn.execute(
                'UPDATE sessions SET feeling=?,note=?,data_json=? WHERE id=?',
                (sess['feeling'], sess['note'], json.dumps(sess['data']), existing['id'])
            )
            updated += 1
        else:
            conn.execute(
                'INSERT INTO sessions (cycle_id,day_index,date,feeling,note,data_json) VALUES (?,?,?,?,?,?)',
                (sess['cycle_id'], sess['day_index'], sess['date'],
                 sess['feeling'], sess['note'], json.dumps(sess['data']))
            )
            imported += 1

    conn.commit()
    conn.close()
    return jsonify({
        'ok': True,
        'imported': imported,
        'updated': updated,
        'errors': errors
    })

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=False)
