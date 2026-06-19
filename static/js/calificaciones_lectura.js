// ==================== CONSTANTES Y VARIABLES GLOBALES ====================

const MAX_INTENTOS = 3;

// Datos inyectados por Flask desde el servidor
const _datosServidor = JSON.parse(
    document.getElementById('datos-servidor').textContent
);

const CONTEXT_KEY      = _datosServidor.context_key;
const NOMBRE_GRUPO     = _datosServidor.nombre_grupo;
const NOMBRE_MATERIA   = _datosServidor.nombre_materia;
const NOMBRE_PARCIAL   = _datosServidor.nombre_parcial;
const ALUMNOS_GRUPO    = _datosServidor.alumnos;       // [{matricula, nombres, apellidos}, ...]
let   calificacionesServer = _datosServidor.calificaciones; // array persistido en JSON del servidor

let archivosProcesadosTemp = [];

// ==================== INICIALIZACIÓN ====================

window.addEventListener('DOMContentLoaded', () => {
    // Limpiar temp al cargar cualquier página nueva
    archivosProcesadosTemp = [];
    verificarYMostrarInterfaz();
});

// ==================== INTERFAZ PRINCIPAL ====================

function verificarYMostrarInterfaz() {
    const main = document.getElementById('contenidoPrincipal');
    if (!main) return;

    const calificaciones = calificacionesServer;

    const breadcrumb = `
        <nav class="breadcrumb-contexto">
            Calificaciones &rsaquo; Grupos &rsaquo; ${escapeHtml(NOMBRE_GRUPO)}
            &rsaquo; ${escapeHtml(NOMBRE_MATERIA)}
            &rsaquo; ${escapeHtml(NOMBRE_PARCIAL)}
        </nav>`;

    const btnRegresar = `
        <button class="btn-volver" onclick="regresarAGrupos()">
            &#8592; Volver a Grupos
        </button>`;

    if (!calificaciones || calificaciones.length === 0) {
        // ── Vista sin archivos ──────────────────────────────────────────────
        main.innerHTML = `
            ${breadcrumb}
            <div class="header-row">
                <h1 class="card-title">${escapeHtml(NOMBRE_MATERIA)}</h1>
                ${btnRegresar}
            </div>

            <div class="upload-zona-central">
                <p class="empty-message">Aún no hay archivos cargados.</p>
                <p class="empty-submessage">Sube los archivos .TORO para ver las calificaciones.</p>

                <button class="btn-txt" id="btnCargarArchivos">
                    <span id="labelArchivos">Cargar respuestas de Alumnos (.TORO)</span>
                    &#x2B06;
                </button>
                <input type="file" id="fileInput" class="file-input"
                       accept=".toro,.TORO" multiple style="display:none;">

                <p class="empty-message">Los archivos que se subirán aquí corresponden a los</p>
                <p class="empty-submessage">creados y enviados por los alumnos (.TORO)</p>

                <div id="fileListContainer" style="display:none; width:100%; max-width:520px;">
                    <h3 class="file-list-title">Archivos procesados:</h3>
                    <div id="previewArchivos"></div>
                    <button class="btn-save" id="saveBtn"
                            style="display:none; margin-top:16px; width:100%;">
                        Guardar calificaciones
                    </button>
                </div>
            </div>
        `;
        configurarEventosSubida();

    } else {
        // ── Vista con datos ─────────────────────────────────────────────────
        main.innerHTML = `
            ${breadcrumb}
            <div class="header-row">
                <h1 class="card-title">${escapeHtml(NOMBRE_MATERIA)}</h1>
                ${btnRegresar}
            </div>

            <div class="tabla-container">
                ${generarTablaCalificaciones(calificaciones)}
            </div>

            <div class="upload-area upload-area--inline">
                <p class="empty-submessage">
                    Sube los archivos .TORO de las nuevas lecciones para actualizar calificaciones.
                </p>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn-save" id="saveBtn" style="display:none;">Guardar</button>
                </div>

            </div>

            <div class="btn-cargar-flotante">
                <button class="btn-txt" id="btnAgregarArchivos">
                    Cargar archivos (.TORO) &#x2B06;
                </button>
            </div>

            <div style="display:none">
                <input type="file" id="fileInput"
                       accept=".toro,.TORO" multiple style="display:none;">
                <div id="previewArchivos"></div>
            </div>
        `;
        configurarEventosConDatos();
    }
}

// ==================== TABLA DINÁMICA POR LECCIONES ====================

function generarTablaCalificaciones(calificaciones) {
    if (!calificaciones || calificaciones.length === 0) {
        return `<p class="empty-message">No hay datos que mostrar.</p>`;
    }

    // 1. Descubrir estructura: progresiones → lecciones
    const progMap     = new Map();
    const leccionMeta = new Map();

    calificaciones.forEach(c => {
        const prog = c.progresion?.trim() || '(Sin progresión)';
        const lec  = c.idLeccion;
        if (!leccionMeta.has(lec)) {
            leccionMeta.set(lec, {
                progresion: prog,
                actividad:  c.actividad?.trim() || lec
            });
        }
        if (!progMap.has(prog)) progMap.set(prog, []);
        if (!progMap.get(prog).includes(lec)) progMap.get(prog).push(lec);
    });

    const leccionesOrdenadas = [];
    progMap.forEach(lecs => lecs.forEach(l => leccionesOrdenadas.push(l)));

    // 2. Agrupar por alumno
    const alumnosMap = new Map();
    calificaciones.forEach(c => {
        const key = c.matricula || c.estudiante;
        if (!alumnosMap.has(key)) {
            alumnosMap.set(key, {
                nombre:    c.estudiante,
                matricula: c.matricula,
                lecciones: {}
            });
        }
        alumnosMap.get(key).lecciones[c.idLeccion] = c;
    });

    // 3. Encabezado fila 1
    let tr1 = `
        <th rowspan="2" class="th-alumno">Nombre del Alumno</th>
        <th rowspan="2" class="th-leccion-fija">Lección</th>
    `;
    progMap.forEach((lecs, prog) => {
        tr1 += `<th colspan="${lecs.length * 3}" class="th-leccion-header">
                    ${escapeHtml(prog)}
                </th>`;
    });
    tr1 += `
        <th rowspan="2" class="th-promedio-general">
            <div class="promedio-header-wrap">
                Promedio
                <button class="btn-tooltip-promedio" id="btnTooltipPromedio"
                        onclick="toggleTooltipPromedio(event)" type="button">?</button>
            </div>
        </th>
        <th rowspan="2" class="th-acciones"></th>
    `;

    // Fila 2 — intentos por lección
    let tr2 = '';
    leccionesOrdenadas.forEach(lec => {
        const meta = leccionMeta.get(lec);
        const titulo = escapeHtml(meta?.actividad || lec);
        tr2 += `
            <th class="th-sub th-intento" title="${titulo}">Int. 1</th>
            <th class="th-sub th-intento" title="${titulo}">Int. 2</th>
            <th class="th-sub th-intento" title="${titulo}">Int. 3</th>
        `;
    });

    // 4. Filas de datos
    let tbody = '';
    alumnosMap.forEach(alumno => {
        const leccionesAlumno = leccionesOrdenadas.filter(lec => alumno.lecciones[lec]);
        const numFilas    = leccionesAlumno.length || 1;
        const promGeneral = calcularPromedioGeneral(alumno.lecciones, leccionesOrdenadas);
        const promTexto   = promGeneral !== null ? promGeneral.toFixed(1) : '—';
        const promClase   = _claseNota(promGeneral);
        const matKey      = escapeHtml(alumno.matricula || alumno.nombre);

        if (leccionesAlumno.length === 0) {
            // Alumno sin ninguna lección
            let tr = `<tr>
                <td class="td-alumno">
                    <strong style="display:block;word-break:break-word;white-space:normal;min-width:120px;max-width:180px;">${escapeHtml(alumno.nombre)}</strong>
                    ${alumno.matricula
                        ? `<span class="matricula-small" style="display:block;word-break:break-word;white-space:normal;">${escapeHtml(alumno.matricula)}</span>`
                        : ''}
                </td>
                <td class="td-leccion td-vacio">—</td>`;
            leccionesOrdenadas.forEach(() => {
                tr += `<td class="td-intento td-vacio">—</td>
                       <td class="td-intento td-vacio">—</td>
                       <td class="td-intento td-vacio">—</td>`;
            });
            tr += `<td class="td-promedio-general">—</td>
                   <td class="td-accion">
                       <button class="btn-eliminar-alumno"
                               onclick="confirmarEliminarAlumno('${matKey}','${escapeHtml(alumno.nombre)}')"
                               title="Eliminar alumno">&#x1F5D1;</button>
                   </td>
                   </tr>`;
            tbody += tr;
            return;
        }

        leccionesAlumno.forEach((lecActual, idx) => {
            let tr = '<tr>';

            // Celda de nombre — solo en primera fila del alumno
            if (idx === 0) {
                tr += `
                    <td rowspan="${numFilas}" 
                        class="td-alumno"
                        style="width: 200px; min-width: 200px; max-width: 200px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                            <strong style="display: block; word-break: break-word; white-space: normal; line-height: 1.3;">
                                ${escapeHtml(alumno.nombre)}
                            </strong>
                            ${alumno.matricula ? `
                                <span style="display: block; word-break: break-word; white-space: normal; font-size: 0.75rem; color: #666;">
                                    ${escapeHtml(alumno.matricula)}
                                </span>
                            ` : ''}
                        </div>
                    </td>
                `;
            }

            tr += `<td class="td-leccion">${escapeHtml(lecActual)}</td>`;

            // Celdas de intentos
            leccionesOrdenadas.forEach(lec => {
                const reg = lec === lecActual ? alumno.lecciones[lec] : null;
                if (!reg) {
                    tr += `<td class="td-intento td-vacio">—</td>
                           <td class="td-intento td-vacio">—</td>
                           <td class="td-intento td-vacio">—</td>`;
                    return;
                }
                const i1 = reg.intentos.find(i => i.numero === 1);
                const i2 = reg.intentos.find(i => i.numero === 2);
                const i3 = reg.intentos.find(i => i.numero === 3);
                tr += `
                    <td class="td-intento ${_claseNota(i1?.calificacion)}">
                        ${i1 !== undefined ? i1.calificacion.toFixed(1) : '—'}
                    </td>
                    <td class="td-intento ${_claseNota(i2?.calificacion)}">
                        ${i2 !== undefined ? i2.calificacion.toFixed(1) : '—'}
                    </td>
                    <td class="td-intento ${_claseNota(i3?.calificacion)}">
                        ${i3 !== undefined ? i3.calificacion.toFixed(1) : '—'}
                    </td>`;
            });

            // Promedio general y botón eliminar — solo en primera fila del alumno
            if (idx === 0) {
                tr += `
                    <td rowspan="${numFilas}" class="td-promedio-general ${promClase}">
                        <strong>${escapeHtml(promTexto)}</strong>
                    </td>
                    <td rowspan="${numFilas}" class="td-accion">
                        <button class="btn-eliminar-alumno"
                                onclick="confirmarEliminarAlumno('${matKey}','${escapeHtml(alumno.nombre)}')"
                                title="Eliminar alumno">&#x1F5D1;</button>
                    </td>`;
            }

            tr += '</tr>';
            tbody += tr;
        });
    });

    return `
        <div class="table-scroll">
            <table class="calificaciones-table">
                <thead>
                    <tr>${tr1}</tr>
                    <tr>${tr2}</tr>
                </thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>
    `;
}

    // Función para establecer anchos dinámicamente
    function establecerAnchosColumnas() {
        const config = {
            nombre: 200,    // px
            leccion: 150,   // px
            intento: 70,    // px
            promedio: 100,  // px
            acciones: 60    // px
        };
        
        // Crear style dinámico
        const style = document.createElement('style');
        style.textContent = `
            .calificaciones-table {
                table-layout: fixed;
                width: 100%;
            }
            .calificaciones-table th.th-alumno,
            .calificaciones-table td.td-alumno {
                width: ${config.nombre}px !important;
                min-width: ${config.nombre}px !important;
                max-width: ${config.nombre}px !important;
            }
            .calificaciones-table th.th-leccion-fija,
            .calificaciones-table td.td-leccion {
                width: ${config.leccion}px !important;
                min-width: ${config.leccion}px !important;
                max-width: ${config.leccion}px !important;
            }
            .calificaciones-table th.th-intento,
            .calificaciones-table td.td-intento {
                width: ${config.intento}px !important;
                min-width: ${config.intento}px !important;
                max-width: ${config.intento}px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Llamar a la función al cargar
    establecerAnchosColumnas();

// Función auxiliar para calcular promedio desde Map
function calcularPromedioGeneralDesdeMap(leccionesMap, todasLasLecciones) {
    let suma = 0;
    let count = 0;
    
    todasLasLecciones.forEach(lec => {
        if (leccionesMap.has(lec)) {
            const leccion = leccionesMap.get(lec);
            if (leccion.intentos && leccion.intentos.length > 0) {
                const mejorIntento = Math.max(...leccion.intentos.map(i => i.calificacion));
                suma += mejorIntento;
                count++;
            }
        }
    });
    
    return count > 0 ? suma / count : null;
}
// ==================== CÁLCULO DE PROMEDIO ====================

function calcularPromedioGeneral(leccionesDelAlumno, leccionesOrdenadas) {
    const ultimosPorLeccion = [];
    leccionesOrdenadas.forEach(lec => {
        const reg = leccionesDelAlumno[lec];
        if (!reg?.intentos?.length) return;
        const ultimo = [...reg.intentos]
            .filter(i => i.numero <= MAX_INTENTOS)
            .sort((a, b) => b.numero - a.numero)[0];
        if (ultimo) ultimosPorLeccion.push(ultimo.calificacion);
    });
    if (!ultimosPorLeccion.length) return null;
    return ultimosPorLeccion.reduce((acc, v) => acc + v, 0) / ultimosPorLeccion.length;
}

function _claseNota(val) {
    if (val === undefined || val === null) return '';
    if (val < 6)  return 'nota-baja';
    if (val >= 9) return 'nota-alta';
    return 'nota-media';
}

// ==================== TOOLTIP PROMEDIO ====================

function toggleTooltipPromedio(e) {
    e.stopPropagation();
    const btn = document.getElementById('btnTooltipPromedio');
    if (!btn) return;
    let box = document.getElementById('tooltipPromedioBox');
    if (!box) {
        box = document.createElement('div');
        box.id        = 'tooltipPromedioBox';
        box.className = 'tooltip-promedio-box';
        box.textContent = 'El promedio se calcula con la calificación del último intento de cada actividad.';
        document.body.appendChild(box);
    }
    if (box.classList.contains('visible')) {
        box.classList.remove('visible');
        return;
    }
    const rect = btn.getBoundingClientRect();
    box.style.cssText = `position:fixed;z-index:9999;
        top:${rect.top - 8}px;
        left:${Math.max(8, rect.right - 220)}px;
        transform:translateY(-100%);`;
    box.classList.add('visible');
}
document.addEventListener('click', () => {
    document.getElementById('tooltipPromedioBox')?.classList.remove('visible');
});

// ==================== ELIMINAR ALUMNO ====================

function confirmarEliminarAlumno(matriculaKey, nombreAlumno) {
    let modal = document.getElementById('modalConfirmarEliminar');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modalConfirmarEliminar';
        modal.className = 'modal-toro-container';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-toro-box">
            <div class="modal-toro-body">
                <div class="modal-toro-icon" style="color:#d97706;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round"
                         style="width:100%;height:100%;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94
                                 a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9"  x2="12"    y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <div class="modal-toro-text">
                    <strong>¿Eliminar alumno?</strong>
                    <p style="margin-top:8px;">
                        Estás a punto de eliminar a
                        <strong>${escapeHtml(nombreAlumno)}</strong>
                        y <em>todas</em> sus calificaciones de este parcial.
                    </p>
                    <p class="sub-alert" style="margin-top:6px;">
                        Esta acción no se puede deshacer.
                    </p>
                </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
                <button class="btn-secundario"
                        onclick="document.getElementById('modalConfirmarEliminar').style.display='none'">
                    Cancelar
                </button>
                <button class="btn-modal-guardar btn-danger-confirm"
                        onclick="ejecutarEliminarAlumno('${escapeHtml(matriculaKey)}')">
                    Eliminar
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

async function ejecutarEliminarAlumno(matriculaKey) {
    try {
        const resp = await fetch('/api/calificaciones/eliminar-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context_key: CONTEXT_KEY, matricula: matriculaKey })
        });
        const json = await resp.json();
        if (json.success) {
            // Actualizar calificacionesServer localmente para no recargar toda la página
            calificacionesServer = (calificacionesServer || []).filter(
                c => (c.matricula || c.estudiante) !== matriculaKey
            );
            // ✅ Limpiar también el buffer temporal para ese alumno
            archivosProcesadosTemp = archivosProcesadosTemp.filter(
                d => (d.matricula || d.estudiante) !== matriculaKey
            );            
            document.getElementById('modalConfirmarEliminar').style.display = 'none';
            mostrarMensaje('Alumno eliminado correctamente', false);
            verificarYMostrarInterfaz();
        } else {
            mostrarMensaje('Error al eliminar: ' + (json.error || 'desconocido'), true);
        }
    } catch {
        mostrarMensaje('Error de conexión al eliminar', true);
    }
}

// ==================== EVENTOS ====================

function configurarEventosSubida() {
    const btnCargar         = document.getElementById('btnCargarArchivos');
    const fileInput         = document.getElementById('fileInput');
    const saveBtn           = document.getElementById('saveBtn');
    const fileListContainer = document.getElementById('fileListContainer');
    const labelArchivos     = document.getElementById('labelArchivos');

    btnCargar?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const procesados = await procesarArchivos(files);
        if (procesados) {
            const validos = archivosProcesadosTemp.length;
            if (labelArchivos)
                labelArchivos.textContent =
                    `${validos} archivo${validos > 1 ? 's' : ''} listo${validos > 1 ? 's' : ''} para guardar`;
            fileListContainer.style.display = 'block';
            saveBtn.style.display = 'inline-block';
        }
        e.target.value = '';
    });

    saveBtn?.addEventListener('click', guardarCalificaciones);
}

function configurarEventosConDatos() {
    const btnAgregar = document.getElementById('btnAgregarArchivos');
//    const btnLimpiar = document.getElementById('btnLimpiarContexto');
    const saveBtn    = document.getElementById('saveBtn');
    let   fileInput  = document.getElementById('fileInput');

    // Clonar para limpiar listeners previos
    const nuevoInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(nuevoInput, fileInput);
    fileInput = nuevoInput;

    btnAgregar?.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const procesados = await procesarArchivos(files);
        if (procesados && saveBtn) saveBtn.style.display = 'inline-block';
        e.target.value = '';
    });

    saveBtn?.addEventListener('click', guardarCalificaciones);
}

// ==================== PROCESAMIENTO DE ARCHIVOS ====================

/**
 * Clave única para un registro: matrícula + lección.
 * Se usa en todas las comprobaciones de duplicados.
 */
function _claveRegistro(matricula, idLeccion) {
    return `${(matricula || '').trim()}::${(idLeccion || '').trim()}`;
}

/**
 * Comprueba si el nuevo archivo trae al menos un intento que NO está
 * todavía en calificacionesServer para ese alumno + lección.
 * Si el registro ni siquiera existe en el servidor, devuelve true.
 */
function _tieneIntentosNuevos(nuevoDatos) {
    const existente = (calificacionesServer || []).find(
        c => c.matricula?.trim() === nuevoDatos.matricula?.trim() &&
             c.idLeccion?.trim() === nuevoDatos.idLeccion?.trim()
    );
    if (!existente) return true;
    return nuevoDatos.intentos.some(
        ni => !existente.intentos.some(ei => ei.numero === ni.numero)
    );
}

async function procesarArchivos(files) {
    const archivosParseados = [];

    // Normalizador: elimina acentos y pasa a minúsculas para comparar
    const norm = str => str
        ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
        : '';

    // Número de parcial esperado (1-based)
    const parcialEsperadoNum = (() => {
        const m = NOMBRE_PARCIAL.match(/\d+/);
        return m ? parseInt(m[0]) : null;
    })();

    for (const file of files) {

        // ── 0. Extensión ─────────────────────────────────────────────────────
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'toro') {
            mostrarMensaje(`✗ ${file.name}: extensión inválida (se esperaba .TORO)`, true, 5000);
            continue;
        }

        // ── 1. Leer y desofuscar ──────────────────────────────────────────────
        let datos;
        try {
            const contenidoRaw = await readFileAsText(file);
            if (!contenidoRaw?.trim()) {
                mostrarMensaje(`✗ ${file.name}: archivo vacío`, true, 5000);
                continue;
            }
            datos = parsearArchivoOfuscado(contenidoRaw, file.name);
        } catch (err) {
            if (err.message?.startsWith('MANIPULADO')) {
                mostrarMensaje(
                    `⚠ ${file.name}: archivo MANIPULADO — calificaciones no confiables`,
                    true, 7000
                );
            } else if (err.message?.startsWith('CORRUPTO')) {
                mostrarMensaje(
                    `✗ ${file.name}: archivo corrupto o Base64 inválido`,
                    true, 5000
                );
            } else if (err.message?.startsWith('INVALIDO')) {
                mostrarMensaje(
                    `✗ ${file.name}: formato no reconocido (no es un archivo .TORO válido)`,
                    true, 5000
                );
            } else {
                mostrarMensaje(`✗ ${file.name}: error inesperado al procesar`, true, 5000);
            }
            continue;
        }

        // ==================== VALIDACIONES DE CAMPOS OBLIGATORIOS ====================
        
        // ── 2. Validar que la MATRÍCULA no esté vacía ──────────────────────────
        if (!datos.matricula || datos.matricula.trim() === '') {
            mostrarMensaje(
                `✗ ${file.name}: la matrícula está vacía. El archivo debe contener la matrícula del alumno.`,
                true, 6000
            );
            continue;
        }

        // ── 3. Validar que el NOMBRE del ESTUDIANTE no esté vacío ───────────────
        if (!datos.estudiante || datos.estudiante.trim() === '') {
            mostrarMensaje(
                `✗ ${file.name}: el nombre del estudiante está vacío. El archivo debe contener el nombre del alumno.`,
                true, 6000
            );
            continue;
        }

        // ── 4. Validar que el GRUPO no esté vacío ───────────────────────────────
        if (!datos.grupo || datos.grupo.trim() === '') {
            mostrarMensaje(
                `✗ ${file.name}: el campo GRUPO está vacío. El archivo debe especificar el grupo.`,
                true, 6000
            );
            continue;
        }

        // ── 5. Validar que la MATERIA no esté vacía ─────────────────────────────
        if (!datos.materia || datos.materia.trim() === '') {
            mostrarMensaje(
                `✗ ${file.name}: el campo MATERIA está vacío. El archivo debe especificar la materia.`,
                true, 6000
            );
            continue;
        }

        // ── 6. Validar que el PARCIAL no esté vacío ─────────────────────────────
        if (datos.parcial === null || datos.parcial === undefined || datos.parcial.toString().trim() === '') {
            mostrarMensaje(
                `✗ ${file.name}: el campo PARCIAL está vacío. El archivo debe especificar el número de parcial.`,
                true, 6000
            );
            continue;
        }

        // ── 7. Validar que la LECCIÓN/ID no esté vacía ──────────────────────────
        if (!datos.idLeccion || datos.idLeccion.trim() === '') {
            mostrarMensaje(
                `✗ ${file.name}: el campo ID_LECCIÓN está vacío. El archivo debe especificar la lección.`,
                true, 6000
            );
            continue;
        }

        // ── 8. Validar que hay al menos un INTENTO ──────────────────────────────
        if (!datos.intentos || datos.intentos.length === 0) {
            mostrarMensaje(
                `✗ ${file.name}: no contiene intentos de calificación. El archivo debe tener al menos un intento.`,
                true, 6000
            );
            continue;
        }

        // ==================== VALIDACIONES DE COINCIDENCIA ====================

        // ── 9. Alumno pertenece al grupo (por matrícula) ──────────────────────
        const enGrupo = ALUMNOS_GRUPO.some(
            a => norm(a.matricula) === norm(datos.matricula)
        );
        if (!enGrupo) {
            mostrarMensaje(
                `✗ ${file.name}: la matrícula "${datos.matricula}" (${datos.estudiante}) no está registrada en el grupo "${NOMBRE_GRUPO}". Verifica que el alumno pertenezca a este grupo.`,
                true, 7000
            );
            continue;
        }

        // ── 10. Grupo del archivo coincide con el contexto ─────────────────────
        if (norm(datos.grupo) !== norm(NOMBRE_GRUPO)) {
            mostrarMensaje(
                `✗ ${file.name}: el archivo es del grupo "${datos.grupo}" pero estás en el grupo "${NOMBRE_GRUPO}". Sube este archivo en el grupo correcto.`,
                true, 7000
            );
            continue;
        }

        // ── 11. Materia coincide con el contexto ───────────────────────────────
        if (norm(datos.materia) !== norm(NOMBRE_MATERIA)) {
            mostrarMensaje(
                `✗ ${file.name}: el archivo es de la materia "${datos.materia}" pero estás en "${NOMBRE_MATERIA}". Sube este archivo en la materia correcta.`,
                true, 7000
            );
            continue;
        }

        // ── 12. Parcial coincide con el contexto ───────────────────────────────
        const parcialArchivo = parseInt(datos.parcial);
        if (parcialEsperadoNum !== null && !isNaN(parcialArchivo) && parcialArchivo !== parcialEsperadoNum) {
            mostrarMensaje(
                `✗ ${file.name}: el archivo es del Parcial ${parcialArchivo} pero estás en "${NOMBRE_PARCIAL}". Sube este archivo en el parcial correcto.`,
                true, 7000
            );
            continue;
        }

        // ── 13. No duplicado en la sesión actual ──────────────────────────────
        const claveReg = _claveRegistro(datos.matricula, datos.idLeccion);
        const yaEnTemp = archivosProcesadosTemp.some(
            t => _claveRegistro(t.matricula, t.idLeccion) === claveReg
        );
        if (yaEnTemp) {
            mostrarMensaje(
                `⚠ ${file.name}: "${datos.estudiante}" / lección ${datos.idLeccion} ya fue agregado en esta sesión`,
                true, 4000
            );
            continue;
        }

        // ── 14. No duplicado en el servidor (sin intentos nuevos) ────────────
        if (!_tieneIntentosNuevos(datos)) {
            mostrarMensaje(
                `⚠ ${file.name}: los intentos de "${datos.estudiante}" en lección ${datos.idLeccion} ya están guardados`,
                true, 4000
            );
            continue;
        }

        // ── ✅ Todos los filtros superados ────────────────────────────────────
        archivosParseados.push(datos);
    }

    if (archivosParseados.length > 0) {
        archivosProcesadosTemp.push(...archivosParseados);
        mostrarPreview(archivosProcesadosTemp);
        mostrarMensaje(`✓ ${archivosParseados.length} archivo(s) listo(s) para guardar`, false);
        return true;
    }
    return false;
}

// ==================== GUARDAR ====================

async function guardarCalificaciones() {
    if (archivosProcesadosTemp.length === 0) return;

    // Validación final antes de guardar
    const registrosInvalidos = validarRegistrosAntesDeGuardar(archivosProcesadosTemp);
    
    if (registrosInvalidos.length > 0) {
        let mensajeError = `No se pueden guardar ${registrosInvalidos.length} archivo(s) con campos vacíos:\n`;
        registrosInvalidos.forEach(ri => {
            mensajeError += `\n• ${ri.archivo} (${ri.alumno}): faltan [${ri.errores.join(', ')}]`;
        });
        mostrarMensaje(mensajeError, true, 10000);
        return;
    }

    // Re-validación de intentos nuevos
    const paraEnviar = archivosProcesadosTemp.filter(d => _tieneIntentosNuevos(d));

    if (paraEnviar.length === 0) {
        mostrarMensaje('No hay calificaciones nuevas para guardar', true, 4000);
        archivosProcesadosTemp = [];
        return;
    }

    try {
        const resp = await fetch('/api/calificaciones/guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context_key: CONTEXT_KEY, calificaciones: paraEnviar })
        });
        const json = await resp.json();
        if (json.success) {
            mostrarMensaje('✓ Calificaciones guardadas con éxito', false);
            archivosProcesadosTemp = [];
            setTimeout(() => location.reload(), 800);
        } else {
            mostrarMensaje('Error al guardar: ' + (json.error || 'desconocido'), true);
        }
    } catch {
        mostrarMensaje('Error de conexión al guardar', true);
    }
}

// ==================== PREVIEW ====================

function mostrarPreview(archivos) {
    const previewDiv = document.getElementById('previewArchivos');
    if (!previewDiv) return;
    let html = '<ul class="file-list">';
    archivos.forEach(a => {
        html += `<li>
            <strong>${escapeHtml(a.nombreArchivo)}</strong><br>
            Alumno: ${escapeHtml(a.estudiante || 'N/A')} |
            Matrícula: ${escapeHtml(a.matricula || 'N/A')} |
            Intentos: ${a.intentos.length}/${MAX_INTENTOS}
        </li>`;
    });
    html += '</ul>';
    previewDiv.innerHTML = html;
}

// ==================== DESOFUSCADO ====================

function desofuscarReporte(base64) {
    // Paso 1: Base64 → bytes (compatible con Python base64.b64encode)
    let bytes;
    try {
        const binStr = atob(base64.trim());
        bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
    } catch {
        throw new Error('CORRUPTO: el archivo no es Base64 válido.');
    }

    // Paso 2: bytes UTF-8 → string (compatible con Python .encode("utf-8"))
    let textoDesplazado;
    try {
        textoDesplazado = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        throw new Error('CORRUPTO: los bytes no son UTF-8 válido.');
    }

    // Paso 3: Revertir César −3
    const textoOriginal = textoDesplazado
        .split('')
        .map(char => String.fromCharCode(char.charCodeAt(0) - 3))
        .join('');

    // Paso 4: Separar contenido de firma y verificar integridad
    const partes = textoOriginal.split('||');
    if (partes.length < 2) {
        throw new Error('INVALIDO: formato de archivo no reconocido (falta separador ||).');
    }

    const contenido      = partes[0];
    const firmaRecibida  = partes[1].trim();
    const firmaCalculada = (contenido.length * 77).toString();

    if (firmaRecibida !== firmaCalculada) {
        throw new Error('MANIPULADO: las firmas no coinciden. Las calificaciones no son confiables.');
    }

    return contenido;
}

function parsearArchivoOfuscado(contenidoRaw, nombreArchivo) {
    const contenido = desofuscarReporte(contenidoRaw);

    const datos = {
        nombreArchivo,
        idLeccion: null, grupo: null, materia: null,
        parcial:   null, progresion: null, actividad: null,
        estudiante: null, matricula: null,
        intentos: [], promedioFinal: null
    };

    const patrones = {
        idLeccion:     /(?:ID_LECCI[OÓ]N|LECCI[OÓ]N):\s*([^\n\r]+)/i,
        grupo:         /GRUPO:\s*([^\n\r]+)/i,
        materia:       /MATERIA:\s*([^\n\r]+)/i,
        parcial:       /PARCIAL:\s*(\d+)/i,
        progresion:    /PROGRESI[OÓ]N:\s*([^\n\r]+)/i,
        actividad:     /ACTIVIDAD:\s*([^\n\r]+)/i,
        estudiante:    /ESTUDIANTE:\s*([^\n\r]+)/i,
        matricula:     /MATR[IÍ]CULA:\s*(\S+)/i,
        promedioFinal: /PROMEDIO FINAL:\s*([\d.]+)/i
    };

    for (const [key, patron] of Object.entries(patrones)) {
        const m = contenido.match(patron);
        if (m) {
            const valor = m[1].trim();
            datos[key] = valor === '' ? null : valor;
        }
    }

    // Validación especial para parcial (puede ser número 0)
    if (datos.parcial !== null) {
        const numParcial = parseInt(datos.parcial);
        if (isNaN(numParcial)) {
            datos.parcial = null;
        }
    }

    const patronIntento = /Intento\s+(\d+):\s+([\d.]+)\/10/g;
    let m;
    while ((m = patronIntento.exec(contenido)) !== null) {
        datos.intentos.push({
            numero:       parseInt(m[1]),
            calificacion: parseFloat(m[2]),
            fecha:        new Date().toLocaleString()
        });
    }
    datos.intentos.sort((a, b) => a.numero - b.numero);
    return datos;
}

/**
 * Validación final antes de guardar en el servidor
 * Asegura que ningún registro tenga campos obligatorios vacíos
 */
function validarRegistrosAntesDeGuardar(registros) {
    const camposObligatorios = ['matricula', 'estudiante', 'grupo', 'materia', 'parcial', 'idLeccion'];
    const registrosInvalidos = [];
    
    for (const registro of registros) {
        const errores = [];
        
        for (const campo of camposObligatorios) {
            const valor = registro[campo];
            if (valor === null || valor === undefined || valor.toString().trim() === '') {
                errores.push(campo);
            }
        }
        
        // Validar que tenga al menos un intento
        if (!registro.intentos || registro.intentos.length === 0) {
            errores.push('intentos');
        }
        
        if (errores.length > 0) {
            registrosInvalidos.push({
                archivo: registro.nombreArchivo || 'desconocido',
                alumno: registro.estudiante || '?',
                errores: errores
            });
        }
    }
    
    return registrosInvalidos;
}

// ==================== LEER ARCHIVO ====================

function readFileAsText(file) {
    // Leemos como ArrayBuffer para evitar que el navegador normalice los \r
    // del archivo .TORO antes de que llegue a desofuscarReporte().
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const bytes = new Uint8Array(e.target.result);
            let str = '';
            for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
            resolve(str.trim());
        };
        reader.onerror = e => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

// ==================== MENSAJES (TOASTS) ====================

function mostrarMensaje(texto, esError = false, duracion = 3800) {
    let contenedor = document.getElementById('toast-contenedor');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-contenedor';
        document.body.appendChild(contenedor);
    }

    const toast  = document.createElement('div');
    toast.className = 'toast-card ' + (esError ? 'toast-error' : 'toast-exito');

    const icono = esError
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
               <circle cx="12" cy="12" r="10"/>
               <line x1="12" y1="8"  x2="12"    y2="12"/>
               <line x1="12" y1="16" x2="12.01" y2="16"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
               <circle cx="12" cy="12" r="10"/>
               <polyline points="9 12 11 14 15 10"/>
           </svg>`;

    toast.innerHTML = `
        <div class="toast-icono">${icono}</div>
        <span class="toast-texto">${escapeHtml(texto)}</span>
        <button class="toast-cerrar"
                onclick="this.closest('.toast-card').remove()">&#x2715;</button>
    `;

    contenedor.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-saliendo');
        setTimeout(() => toast.remove(), 350);
    }, duracion);
}

// ==================== NAVEGACIÓN ====================

function regresarAGrupos() {
    window.location.href = '/calificaciones';
}

// ==================== ESCAPE HTML ====================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m =>
        m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'
    );
}