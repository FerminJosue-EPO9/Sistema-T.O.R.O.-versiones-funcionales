// ══════════════════════════════════════════════════════════
//  GRUPOS.JS — Conectado al backend Flask (/api/...)
//  Sin localStorage, sin prompt(), sin confirm()
//  Todos los inputs y confirmaciones usan modales propios
// ══════════════════════════════════════════════════════════

// ── Variables de estado ──
let archivoValidado   = false;
let datosAlumnos      = null;

let grupoMateriaTarget   = null;  // { idxGrupo }
let editarMateriaTarget  = null;  // { idxGrupo, idxMateria }
let accionEliminar       = null;  // función a ejecutar al confirmar eliminación

let parcialTarget        = null;  // { idxGrupo, idxMateria }
let editarParcialTarget  = null;  // { idxGrupo, idxMateria, idxParcial }

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    const inputArchivo = document.getElementById("archivoAlumnos");
    if (inputArchivo) inputArchivo.addEventListener("change", validarArchivo);

    actualizarBreadcrumb(["Grupos"]);
    cargarYElegirSeccion();
});

// ══════════════════════════════════════════════════════════
//  CARGA Y SECCIÓN
// ══════════════════════════════════════════════════════════
function cargarYElegirSeccion() {
    fetch("/api/grupos")
        .then(r => r.json())
        .then(grupos => {
            if (!grupos || grupos.length === 0) {
                mostrarSeccion("seccionDefault");
                document.getElementById("listaGrupos").innerHTML = "";
            } else {
                renderizarGrupos(grupos);
                mostrarSeccion("mostrarGrupos");
            }
        })
        .catch(() => mostrarSeccion("seccionDefault"));
}

function mostrarSeccion(id) {
    document.querySelectorAll(".seccion").forEach(s => s.classList.remove("activa"));
    const sec = document.getElementById(id);
    if (sec) sec.classList.add("activa");
}

function actualizarBreadcrumb(ruta) {
    const bc = document.getElementById("breadcrumbTexto");
    if (!bc) return;

    bc.innerHTML = ruta.join(" > ");
}

// ══════════════════════════════════════════════════════════
//  MODAL NUEVO GRUPO
// ══════════════════════════════════════════════════════════
function abrirModal() {
    limpiarModalGrupo();
    actualizarBreadcrumb(["Grupos", "Crear grupo"]);   
    _abrirModal("modalNuevoGrupo");
}

function cerrarModal() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalNuevoGrupo");
    limpiarModalGrupo();
}

function limpiarModalGrupo() {
    const n = document.getElementById("nombreGrupo");
    const a = document.getElementById("archivoAlumnos");
    if (n) n.value = "";
    if (a) a.value = "";
    archivoValidado = false;
    datosAlumnos    = null;
    mostrarMensajeModal("", "");
}

// ── Validar archivo al seleccionarlo ──
function validarArchivo(event) {
    const archivo = event.target.files[0];
    if (!archivo) {
        archivoValidado = false;
        datosAlumnos    = null;
        mostrarMensajeModal("", "");
        return;
    }

    const lector = new FileReader();
    lector.onload = function(e) {
        const contenido = e.target.result.replace(/\r/g, "").trim();
        if (!contenido) {
            mostrarMensajeModal("El archivo está vacío.", "error");
            archivoValidado = false;
            datosAlumnos    = null;
            return;
        }
        const lineas = contenido.split("\n").filter(l => l.trim() !== "");
        const temp   = [];
        for (let i = 0; i < lineas.length; i++) {
            const partes = lineas[i].split("|");
            if (partes.length !== 3) {
                mostrarMensajeModal(`Error en línea ${i+1}: debe tener 3 campos separados por "|".`, "error");
                archivoValidado = false;
                datosAlumnos    = null;
                return;
            }
            const [matricula, nombres, apellidos] = partes.map(p => p.trim());
            if (!matricula || !nombres || !apellidos) {
                mostrarMensajeModal(`Error en línea ${i+1}: ningún campo puede estar vacío.`, "error");
                archivoValidado = false;
                datosAlumnos    = null;
                return;
            }
            temp.push({ matricula, nombres, apellidos });
        }
        mostrarMensajeModal(`Archivo válido. ${temp.length} alumnos cargados.`, "exito");
        archivoValidado = true;
        datosAlumnos    = temp;
    };
    lector.readAsText(archivo, "UTF-8");
}

function mostrarMensajeModal(texto, tipo) {
    const div = document.getElementById("mensajeModal");
    if (!div) return;
    if (!texto) {
        div.style.display = "none";
        div.className     = "mensaje-modal";
        div.textContent   = "";
        return;
    }
    div.textContent = texto;
    div.className   = "mensaje-modal " + tipo;
}

// ── Guardar grupo → POST /crear_grupo ──
function guardarGrupo() {
    const nombre      = document.getElementById("nombreGrupo").value.trim();
    const archivoInput = document.getElementById("archivoAlumnos");

    if (!nombre) {
        mostrarMensajeModal("El nombre del grupo es obligatorio.", "error");
        return;
    }
    if (!archivoInput.files.length) {
        mostrarMensajeModal("Selecciona un archivo .txt con la lista de alumnos.", "error");
        return;
    }
    if (!archivoValidado || !datosAlumnos) {
        mostrarMensajeModal("El archivo no es válido. Verifica el formato.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("nombre",  nombre);
    formData.append("archivo", archivoInput.files[0]);

    fetch("/crear_grupo", { method: "POST", body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.exito) {
                mostrarMensajeModal("¡Grupo creado correctamente!", "exito");
                setTimeout(() => {
                    cerrarModal();
                    cargarYElegirSeccion();
                }, 1200);
            } else {
                mostrarMensajeModal("Error: " + (data.mensaje || "No se pudo crear."), "error");
            }
        })
        .catch(() => mostrarMensajeModal("Error de conexión con el servidor.", "error"));
}

// ══════════════════════════════════════════════════════════
//  RENDERIZADO DE GRUPOS
// ══════════════════════════════════════════════════════════
function renderizarGrupos(grupos) {
    const contenedor = document.getElementById("listaGrupos");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    grupos.forEach((grupo, idxGrupo) => {
        const tarjeta = document.createElement("div");
        tarjeta.classList.add("grupo-card");
        tarjeta.innerHTML = `
            <div class="grupo-header">
                <span class="nombreGrupo">Grupo ${grupo.nombre}</span>
                <div style="display:flex;gap:10px;align-items:center;">
                    <button class="btn-materia" onclick="agregarMateria(${idxGrupo})">+ Materia</button>
                    <button class="btn-eliminar-grupo" onclick="abrirModalEliminarGrupo(${idxGrupo})" title="Eliminar grupo">
                        <img src="/static/img/eliminar.svg" alt="Eliminar">
                    </button>
                </div>
            </div>
            <div class="grupo-body" id="materias-${idxGrupo}"></div>
        `;
        contenedor.appendChild(tarjeta);
        renderizarMaterias(grupo.materias, idxGrupo);
    });
}

function renderizarMaterias(materias, idxGrupo) {
    const cont = document.getElementById(`materias-${idxGrupo}`);
    if (!cont) return;
    cont.innerHTML = "";

    if (!materias || materias.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio">Aún no hay materias en este grupo.</p>`;
        return;
    }

    materias.forEach((materia, idxMateria) => {
        const div = document.createElement("div");
        div.classList.add("contenedor-materia-parcial");
        div.innerHTML = `
            <div class="contenedor-materia-acciones">
                <span class="nombreMateria">${materia.nombre}</span>
                <div class="acciones-materia">
                    <button class="btn-eliminar-materia"
                        onclick="abrirModalEliminarMateria(${idxGrupo}, ${idxMateria})"
                        title="Eliminar materia">
                        <img src="/static/img/eliminar2.png" alt="Eliminar">
                    </button>
                    <button class="btn-editar-materia"
                        onclick="editarMateria(${idxGrupo}, ${idxMateria})"
                        title="Editar materia">
                        <img src="/static/img/editar2.png" alt="Editar">
                    </button>
                </div>
            </div>
            <div class="parcial-contenedor" id="parciales-${idxGrupo}-${idxMateria}"></div>
            <button class="btn-agregarParcial" onclick="agregarParcial(${idxGrupo}, ${idxMateria})">
                + Añadir parcial
            </button>
        `;
        cont.appendChild(div);
        renderizarParciales(materia.parciales, idxGrupo, idxMateria);
    });
}

function renderizarParciales(parciales, idxGrupo, idxMateria) {
    const cont = document.getElementById(`parciales-${idxGrupo}-${idxMateria}`);
    if (!cont) return;
    cont.innerHTML = "";
    if (!parciales || parciales.length === 0) return;

    parciales.forEach((parcial, idxParcial) => {
        const chip = document.createElement("div");
        chip.classList.add("parciales-container");
        chip.innerHTML = `
            <button class="parcial-item"
                onclick="irAProgresiones(${idxGrupo}, ${idxMateria}, ${idxParcial})">
                ${parcial.nombre}
            </button>
            <div class="acciones-parcial">
                <button class="btn-eliminarParcial"
                    onclick="abrirModalEliminarParcial(${idxGrupo}, ${idxMateria}, ${idxParcial})"
                    title="Eliminar parcial">
                    <img src="/static/img/eliminar2.png" alt="Eliminar">
                </button>
                <button class="btn-editarParcial"
                    onclick="editarParcial(${idxGrupo}, ${idxMateria}, ${idxParcial})"
                    title="Editar parcial">
                    <img src="/static/img/editar2.png" alt="Editar">
                </button>
            </div>
        `;
        cont.appendChild(chip);
    });
}

// ══════════════════════════════════════════════════════════
//  MODAL ELIMINAR (genérico)
// ══════════════════════════════════════════════════════════
function _abrirModalEliminar(titulo, linea1, linea2, textoBtn, chipsHTML, accion) {
    document.getElementById("tituloModalEliminar").textContent  = titulo;
    document.getElementById("textoEliminarLinea1").textContent  = linea1;
    document.getElementById("textoEliminarLinea2").textContent  = linea2;
    document.getElementById("textoBotonEliminar").textContent   = textoBtn;

    const extra = document.getElementById("infoEliminarExtra");
    if (chipsHTML) {
        extra.innerHTML      = chipsHTML;
        extra.style.display  = "flex";
    } else {
        extra.innerHTML      = "";
        extra.style.display  = "none";
    }

    accionEliminar = accion;
    _abrirModal("modalEliminar");
}

function ejecutarEliminar() {
    if (typeof accionEliminar === "function") accionEliminar();
    accionEliminar = null;
}

function cerrarModalEliminar() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEliminar");
    accionEliminar = null;
}

// ── Eliminar grupo ──
function abrirModalEliminarGrupo(idxGrupo) {
    actualizarBreadcrumb(["Grupos", "Eliminar grupo"]);
    _abrirModalEliminar(
        "ELIMINAR GRUPO",
        "¿Estás seguro de que deseas eliminar este grupo?",
        "Se perderán todos los datos de forma permanente.",
        "Eliminar grupo",
        null,
        () => ejecutarEliminarGrupo(idxGrupo)
    );
}

function ejecutarEliminarGrupo(idxGrupo) {
    fetch("/api/eliminar_elemento", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEliminar();
        if (data.exito) {
            if (data.lecciones_eliminadas && data.lecciones_eliminadas > 0) {
                mostrarModalInfo("Lecciones eliminadas", `Se han eliminado ${data.lecciones_eliminadas} lección(es) que dependían de este grupo.`);
            }
            cargarYElegirSeccion();
        } else {
            console.error(data.mensaje);
            mostrarModalInfo("Error", data.mensaje || "No se pudo eliminar el grupo.");
        }
    });
}

// ── Eliminar materia ──
function abrirModalEliminarMateria(idxGrupo, idxMateria) {
    actualizarBreadcrumb(["Grupos", "Eliminar materia"]);
    _abrirModalEliminar(
        "ELIMINAR MATERIA",
        "¿Estás seguro de que deseas eliminar esta materia?",
        "Se perderán también todos sus parciales de forma permanente.",
        "Eliminar materia",
        null,
        () => ejecutarEliminarMateria(idxGrupo, idxMateria)
    );
}

function ejecutarEliminarMateria(idxGrupo, idxMateria) {
    fetch("/api/eliminar_elemento", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEliminar();
        if (data.exito) {
            if (data.lecciones_eliminadas && data.lecciones_eliminadas > 0) {
                mostrarModalInfo("Lecciones eliminadas", `Se han eliminado ${data.lecciones_eliminadas} lección(es) que dependían de esta materia.`);
            }
            cargarYElegirSeccion();
        } else {
            console.error(data.mensaje);
            mostrarModalInfo("Error", data.mensaje || "No se pudo eliminar la materia.");
        }
    });
}

// ── Eliminar parcial ──
function abrirModalEliminarParcial(idxGrupo, idxMateria, idxParcial) {
    // Necesitamos el nombre del parcial → lo leemos del DOM
    const chip = document.querySelector(
        `#parciales-${idxGrupo}-${idxMateria} .parciales-container:nth-child(${idxParcial + 1}) .parcial-item`
    );
    const nombreParcial = chip ? chip.textContent.trim() : `Parcial ${idxParcial + 1}`;
    const nombreMateria = document.querySelector(
        `#materias-${idxGrupo} .contenedor-materia-parcial:nth-child(${idxMateria + 1}) .nombreMateria`
    );
    const materia = nombreMateria ? nombreMateria.textContent.trim() : "";

    const chips = `
        <div class="chip-info">${materia}</div>
        <div class="chip-info">${nombreParcial}</div>
    `;
    actualizarBreadcrumb(["Grupos", "Eliminar parcial"]);
    _abrirModalEliminar(
        "ELIMINAR PARCIAL",
        "¿Estás seguro que quieres eliminar este parcial?",
        "Se perderán sus progresiones de forma permanente.",
        "Eliminar parcial",
        chips,
        () => ejecutarEliminarParcial(idxGrupo, idxMateria, idxParcial)
    );
}

function ejecutarEliminarParcial(idxGrupo, idxMateria, idxParcial) {
    fetch("/api/eliminar_elemento", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria, parcial: idxParcial })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEliminar();
        if (data.exito) {
            if (data.lecciones_eliminadas && data.lecciones_eliminadas > 0) {
                mostrarModalInfo("Lecciones eliminadas", `Se han eliminado ${data.lecciones_eliminadas} lección(es) que dependían de este parcial.`);
            }
            cargarYElegirSeccion();
        } else {
            console.error(data.mensaje);
            mostrarModalInfo("Error", data.mensaje || "No se pudo eliminar el parcial.");
        }
    });
}

// ══════════════════════════════════════════════════════════
//  MATERIAS
// ══════════════════════════════════════════════════════════
function agregarMateria(idxGrupo) {
    grupoMateriaTarget = { idxGrupo };
    document.getElementById("inputNombreMateria").value = "";
    actualizarBreadcrumb(["Grupos", "Agregar materia"]);
    _abrirModal("modalAgregarMateria");
    setTimeout(() => document.getElementById("inputNombreMateria").focus(), 120);
}

function cerrarModalMateria() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalAgregarMateria");
    grupoMateriaTarget = null;
}

function confirmarAgregarMateria() {
    const nombre = document.getElementById("inputNombreMateria").value.trim();
    if (!nombre || !grupoMateriaTarget) return;

    fetch("/api/crear_materia", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: grupoMateriaTarget.idxGrupo, materia: nombre })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalMateria();
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

// ── Editar materia ──
function editarMateria(idxGrupo, idxMateria) {
    const span = document.querySelector(
        `#materias-${idxGrupo} .contenedor-materia-parcial:nth-child(${idxMateria + 1}) .nombreMateria`
    );
    const nombreActual = span ? span.textContent.trim() : "";
    editarMateriaTarget = { idxGrupo, idxMateria };
    document.getElementById("inputEditarMateria").value = nombreActual;
    actualizarBreadcrumb(["Grupos", "Editar materia"]);
    _abrirModal("modalEditarMateria");
    setTimeout(() => document.getElementById("inputEditarMateria").focus(), 120);
}

function cerrarModalEditarMateria() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEditarMateria");
    editarMateriaTarget = null;
}

function confirmarEditarMateria() {
    const nuevoNombre = document.getElementById("inputEditarMateria").value.trim();
    if (!nuevoNombre || !editarMateriaTarget) return;

    // El backend actual no tiene endpoint de editar materia.
    // Implementación: eliminar + crear (o se puede añadir ruta al backend).
    // Por ahora mostramos aviso hasta que la ruta exista:
    const { idxGrupo, idxMateria } = editarMateriaTarget;
    fetch("/api/editar_materia", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria, nombre: nuevoNombre })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEditarMateria();
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje || "Función pendiente en el servidor.");
    })
    .catch(() => {
        cerrarModalEditarMateria();
        alert("El endpoint /api/editar_materia no está implementado aún en app.py.");
    });
}

// ══════════════════════════════════════════════════════════
//  PARCIALES
// ══════════════════════════════════════════════════════════
function agregarParcial(idxGrupo, idxMateria) {
    // Contar parciales actuales desde el DOM
    const cont      = document.getElementById(`parciales-${idxGrupo}-${idxMateria}`);
    const total     = cont ? cont.querySelectorAll(".parciales-container").length : 0;
    const siguiente = total + 1;

    parcialTarget = { idxGrupo, idxMateria };

    const preview  = document.getElementById("nombreParcialPreview");
    const limite   = document.getElementById("limiteParcialMsg");
    const btnConf  = document.getElementById("btnConfirmarParcial");

    if (total >= 3) {
        preview.style.display   = "none";
        limite.style.display    = "block";
        btnConf.disabled        = true;
    } else {
        preview.style.display   = "inline-block";
        preview.textContent     = `Parcial ${siguiente}`;
        limite.style.display    = "none";
        btnConf.disabled        = false;
    }
    actualizarBreadcrumb(["Grupos", "Agregar parcial"]);
    _abrirModal("modalAgregarParcial");
}

function cerrarModalParcial() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalAgregarParcial");
    parcialTarget = null;
}

function confirmarAgregarParcial() {
    if (!parcialTarget) return;
    const { idxGrupo, idxMateria } = parcialTarget;
    const cont    = document.getElementById(`parciales-${idxGrupo}-${idxMateria}`);
    const total   = cont ? cont.querySelectorAll(".parciales-container").length : 0;
    if (total >= 3) return;

    const nombre  = `Parcial ${total + 1}`;

    fetch("/api/crear_parcial", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria, nombre })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalParcial();
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

// ── Editar parcial ──
function editarParcial(idxGrupo, idxMateria, idxParcial) {
    editarParcialTarget = { idxGrupo, idxMateria, idxParcial };
    const numero = idxParcial + 1; // valor inicial según posición
    const input  = document.getElementById("inputEditarParcial");
    input.value  = numero;
    input.style.border = "";
    actualizarBreadcrumb(["Grupos", "Editar parcial"]);
    _abrirModal("modalEditarParcial");
    setTimeout(() => input.focus(), 120);
}

function cerrarModalEditarParcial() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEditarParcial");
    editarParcialTarget = null;
}

function confirmarEditarParcial() {
    const numero = parseInt(document.getElementById("inputEditarParcial").value);
    const input  = document.getElementById("inputEditarParcial");

    if (isNaN(numero) || numero < 1 || numero > 3) {
        input.style.border = "2px solid red";
        return;
    }
    input.style.border = "";

    if (!editarParcialTarget) return;
    const { idxGrupo, idxMateria, idxParcial } = editarParcialTarget;

    fetch("/api/editar_parcial", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria, parcial: idxParcial, nombre: `Parcial ${numero}` })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEditarParcial();
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje || "Función pendiente en el servidor.");
    })
    .catch(() => {
        cerrarModalEditarParcial();
        alert("El endpoint /api/editar_parcial no está implementado aún en app.py.");
    });
}

// ══════════════════════════════════════════════════════════
//  NAVEGACIÓN A PROGRESIONES
// ══════════════════════════════════════════════════════════
function irAProgresiones(idxGrupo, idxMateria, idxParcial) {
    localStorage.setItem("progresionContexto", JSON.stringify({
        grupo: idxGrupo, materia: idxMateria, parcial: idxParcial
    }));
    window.location.href = "/progresiones";
}

// ══════════════════════════════════════════════════════════
//  HELPERS DE MODAL (abrir / cerrar con animación)
// ══════════════════════════════════════════════════════════
function _abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("activa");
}

function _cerrarModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("cerrando");
    setTimeout(() => {
        modal.classList.remove("activa", "cerrando");
    }, 250);
}

// ══════════════════════════════════════════════════════════
//  MODAL DE INFORMACIÓN
// ══════════════════════════════════════════════════════════
function mostrarModalInfo(titulo, mensaje) {
    document.getElementById("tituloModalInfo").textContent = titulo;
    document.getElementById("textoModalInfo").textContent = mensaje;
    _abrirModal("modalInfo");
}

function cerrarModalInfo() {
    _cerrarModal("modalInfo");
}