import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

actividades_bp = Blueprint('actividades', __name__)

def ensure_actividades_folder():
    base_dir = current_app.root_path
    actividades_dir = os.path.join(base_dir, 'data', 'actividades')
    os.makedirs(actividades_dir, exist_ok=True)
    return actividades_dir

def obtener_siguiente_id_actividad():
    base_dir = current_app.root_path
    ruta_contador = os.path.join(base_dir, 'data', 'contador_actividades.json')
    os.makedirs(os.path.dirname(ruta_contador), exist_ok=True)
    if os.path.exists(ruta_contador):
        with open(ruta_contador, 'r', encoding='utf-8') as f:
            data = json.load(f)
            ultimo = data.get('ultimo_id', 0)
    else:
        ultimo = 0
    nuevo_num = ultimo + 1
    with open(ruta_contador, 'w', encoding='utf-8') as f:
        json.dump({'ultimo_id': nuevo_num}, f)
    return f"ACT-{nuevo_num:03d}"

@actividades_bp.route('/guardar_actividad_txt', methods=['POST'])
def guardar_actividad_txt():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No se recibieron datos'}), 400

        nombre = data.get('nombre', 'Sin_titulo')
        intentos = data.get('intentos', '3')
        tiempo = data.get('tiempo', '')
        fecha_vencimiento = data.get('fecha_vencimiento', 'No definida')
        ponderacion = data.get('ponderacion', '0')
        tipo = data.get('tipo', 'completar-camino')

        fecha_hoy = datetime.now().strftime('%d/%m/%Y')
        id_actividad = obtener_siguiente_id_actividad()

        # Cabeceras comunes
        contenido = f"ID_ACTIVIDAD: {id_actividad}\n"
        contenido += f"FECHA: {fecha_hoy}\n"
        contenido += f"NOMBRE: {nombre}\n"
        contenido += f"LECCION: General\n"
        contenido += f"INTENTOS: {intentos}\n"
        contenido += f"TIEMPO: {tiempo if tiempo else 'Sin límite'} minutos\n"
        contenido += f"PONDERACION: {ponderacion}\n"
        contenido += f"FECHA_VENCIMIENTO: {fecha_vencimiento}\n"

        if tipo == 'completar-camino':
            id_plantilla = 'C001'
            izquierda = data.get('izquierda', [])
            derecha = data.get('derecha', [])
            respuestas = data.get('respuestas', {})

            contenido += f"ID_PLANTILLA: {id_plantilla}\n"
            contenido += "---\n\n"

            contenido += "const izquierda = [\n"
            for item in izquierda:
                contenido += f'            "{item}",\n'
            if izquierda:
                contenido = contenido.rstrip(',\n') + "\n        ];\n\n"
            else:
                contenido += "        ];\n\n"

            contenido += "const derecha = [\n"
            for item in derecha:
                contenido += f'            "{item}",\n'
            if derecha:
                contenido = contenido.rstrip(',\n') + "\n        ];\n\n"
            else:
                contenido += "        ];\n\n"

            contenido += "const respuestas = {\n"
            for pregunta, palabra in respuestas.items():
                contenido += f'            "{pregunta}": "{palabra}",\n'
            if respuestas:
                contenido = contenido.rstrip(',\n') + "\n        };\n\n"
            else:
                contenido += "        };\n\n"

            contenido += "@@@ Métricas: \n"
            contenido += f"tipo:{tipo}\n"
            contenido += f"nombre:{nombre}\n"
            contenido += f"intentos:{intentos}\n"
            if tiempo:
                contenido += f"tiempo:{tiempo}\n"
            contenido += f"fecha-vencimiento:{fecha_vencimiento}\n"
            contenido += f"ponderacion:{ponderacion}\n"

        elif tipo == 'falso-verdadero':
            id_plantilla = 'P002'
            preguntas = data.get('preguntas', [])
            if not preguntas:
                return jsonify({'success': False, 'error': 'No hay preguntas para Falso/Verdadero'}), 400

            contenido += f"ID_PLANTILLA: {id_plantilla}\n"
            contenido += "---\n\n"

            for idx, p in enumerate(preguntas, 1):
                contenido += f"Pregunta {idx}: {p['afirmacion']}\n"
                contenido += f"Respuesta: {p['respuesta']}\n\n"

            contenido += "@@@ Métricas: \n"
            contenido += f"tipo:{tipo}\n"
            contenido += f"nombre:{nombre}\n"
            contenido += f"intentos:{intentos}\n"
            if tiempo:
                contenido += f"tiempo:{tiempo}\n"
            contenido += f"fecha-vencimiento:{fecha_vencimiento}\n"
            contenido += f"ponderacion:{ponderacion}\n"

        elif tipo == 'opcion-multiple':
            id_plantilla = 'P003'
            preguntas = data.get('preguntas', [])
            if not preguntas:
                return jsonify({'success': False, 'error': 'No hay preguntas'}), 400
            contenido += f"ID_PLANTILLA: {id_plantilla}\n"
            contenido += "---\n\n"
            for idx, p in enumerate(preguntas, 1):
                contenido += f"Pregunta {idx}: {p['afirmacion']}\n"
                contenido += f"Opciones: {' | '.join(p['opciones'])}\n"
                contenido += f"Respuesta correcta: {p['respuesta']}\n\n"
            contenido += "@@@ Métricas: \n"
            contenido += f"tipo:{tipo}\n"
            contenido += f"nombre:{nombre}\n"
            contenido += f"intentos:{intentos}\n"
            if tiempo:
                contenido += f"tiempo:{tiempo}\n"
            contenido += f"fecha-vencimiento:{fecha_vencimiento}\n"
            contenido += f"ponderacion:{ponderacion}\n"

        elif tipo == 'sopa-letras':
            id_plantilla = 'P004'
            palabras = data.get('palabras', [])
            descripciones = data.get('descripciones', [])
            respuestas = data.get('respuestas', {})

            contenido += f"ID_PLANTILLA: {id_plantilla}\n"
            contenido += "---\n\n"

            contenido += "const descripciones = [\n"
            for item in descripciones:
                contenido += f'            "{item}",\n'
            if descripciones:
                contenido = contenido.rstrip(',\n') + "\n        ];\n\n"
            else:
                contenido += "        ];\n\n"

            contenido += "const palabras = [\n"
            for item in palabras:
                contenido += f'            "{item}",\n'
            if palabras:
                contenido = contenido.rstrip(',\n') + "\n        ];\n\n"
            else:
                contenido += "        ];\n\n"

            contenido += "const respuestas = {\n"
            for desc, pal in respuestas.items():
                contenido += f'            "{desc}": "{pal}",\n'
            if respuestas:
                contenido = contenido.rstrip(',\n') + "\n        };\n\n"
            else:
                contenido += "        };\n\n"

            contenido += "@@@ Métricas: \n"
            contenido += f"tipo:{tipo}\n"
            contenido += f"nombre:{nombre}\n"
            contenido += f"intentos:{intentos}\n"
            if tiempo:
                contenido += f"tiempo:{tiempo}\n"
            contenido += f"fecha-vencimiento:{fecha_vencimiento}\n"
            contenido += f"ponderacion:{ponderacion}\n"

        else:
            return jsonify({'success': False, 'error': 'Tipo de actividad no soportado'}), 400

        # Guardar archivo (común para todos los tipos)
        nombre_archivo = secure_filename(f"{nombre}.txt".replace(' ', '_'))
        actividades_dir = ensure_actividades_folder()
        ruta_completa = os.path.join(actividades_dir, nombre_archivo)

        # Evitar sobrescritura
        if os.path.exists(ruta_completa):
            base, ext = os.path.splitext(nombre_archivo)
            contador = 1
            while os.path.exists(os.path.join(actividades_dir, f"{base}_{contador}{ext}")):
                contador += 1
            nombre_archivo = f"{base}_{contador}{ext}"
            ruta_completa = os.path.join(actividades_dir, nombre_archivo)

        with open(ruta_completa, 'w', encoding='utf-8') as f:
            f.write(contenido)

        print(f"✅ Actividad guardada con ID {id_actividad} en: {ruta_completa}")

        return jsonify({
            'success': True,
            'ruta': ruta_completa,
            'archivo': nombre_archivo,
            'id_actividad': id_actividad
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500